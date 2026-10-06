-- =============================================================================
-- Funciones de negocio: huecos libres, reservar, mover, anonimizar y fusionar.
--
-- Todas son SECURITY DEFINER y comprueban los permisos por dentro:
--   * con sesión de usuario (auth.uid() no nulo): tiene que ser admin de la clínica;
--   * sin sesión: solo el servidor con la clave de servicio puede llamarlas
--     (al visitante anónimo se le retira el permiso de ejecución).
-- =============================================================================

-- ¿Está la clínica abierta en ese momento? (horario semanal y cierres)
create or replace function public.clinica_abierta_en(p_clinica_id uuid, p_momento timestamptz)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with local as (
    select (p_momento at time zone c.zona_horaria) as ts
    from public.clinicas c
    where c.id = p_clinica_id
  )
  select exists (
      select 1
      from public.horarios_clinica h, local
      where h.clinica_id = p_clinica_id
        and h.dia_semana = extract(isodow from local.ts)
        and local.ts::time >= h.hora_inicio
        and local.ts::time < h.hora_fin
    )
    and not exists (
      select 1
      from public.cierres_clinica ci, local
      where ci.clinica_id = p_clinica_id
        and local.ts::date between ci.fecha_inicio and ci.fecha_fin
    );
$$;

-- -----------------------------------------------------------------------------
-- Huecos libres para un tratamiento entre dos fechas (como máximo 62 días).
-- Un hueco es válido si:
--   * la clínica y el tratamiento están activos y el día no es festivo/cierre;
--   * la profesional hace ese tratamiento, está activa y trabaja a esa hora,
--     dentro del horario de la clínica;
--   * respeta la antelación mínima de la clínica;
--   * la profesional no tiene otra cita ni una ausencia que se cruce;
--   * si el tratamiento necesita cabina, hay alguna de sus cabinas libre.
-- Si p_profesional_id es null ("cualquiera"), devuelve un hueco por profesional.
-- p_ignorar_antelacion: el panel de la clínica puede reservar para dentro de un rato.
-- -----------------------------------------------------------------------------
create or replace function public.huecos_libres(
  p_clinica_id uuid,
  p_tratamiento_id uuid,
  p_profesional_id uuid,
  p_desde date,
  p_hasta date,
  p_ignorar_antelacion boolean default false
)
returns table (inicio timestamptz, fin timestamptz, profesional_id uuid, cabina_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  with cfg as (
    select c.zona_horaria as tz,
           make_interval(mins => c.intervalo_huecos_min) as paso,
           make_interval(mins => c.antelacion_minima_reserva_min) as antelacion,
           make_interval(mins => t.duracion_min) as duracion
    from public.clinicas c
    join public.tratamientos t on t.clinica_id = c.id
    where c.id = p_clinica_id
      and t.id = p_tratamiento_id
      and c.activa
      and t.activo
      and (auth.uid() is null or public.es_miembro_de(p_clinica_id))
  ),
  necesita_cabina as (
    select exists (
      select 1 from public.tratamiento_cabinas tc where tc.tratamiento_id = p_tratamiento_id
    ) as si
  ),
  dias as (
    select d::date as dia
    from generate_series(p_desde, least(p_hasta, p_desde + 62), interval '1 day') as d
    where not exists (
      select 1 from public.cierres_clinica ci
      where ci.clinica_id = p_clinica_id and d::date between ci.fecha_inicio and ci.fecha_fin
    )
  ),
  profs as (
    select p.id
    from public.profesionales p
    join public.tratamiento_profesionales tp
      on tp.profesional_id = p.id and tp.tratamiento_id = p_tratamiento_id
    where p.clinica_id = p_clinica_id
      and p.activa
      and (p_profesional_id is null or p.id = p_profesional_id)
  ),
  -- Tramos en que trabaja la profesional y la clínica está abierta
  tramos as (
    select pr.id as prof,
           dias.dia,
           greatest(hp.hora_inicio, hc.hora_inicio) as desde,
           least(hp.hora_fin, hc.hora_fin) as hasta
    from profs pr
    cross join dias
    join public.horarios_profesional hp
      on hp.profesional_id = pr.id and hp.dia_semana = extract(isodow from dias.dia)
    join public.horarios_clinica hc
      on hc.clinica_id = p_clinica_id
     and hc.dia_semana = hp.dia_semana
     and hc.hora_inicio < hp.hora_fin
     and hp.hora_inicio < hc.hora_fin
  ),
  candidatos as (
    select t.prof,
           (s.ts at time zone cfg.tz) as ini,
           (s.ts at time zone cfg.tz) + cfg.duracion as fin
    from tramos t
    cross join cfg
    cross join lateral generate_series(
      t.dia + t.desde,
      t.dia + t.hasta - cfg.duracion,
      cfg.paso
    ) as s(ts)
  )
  select c.ini, c.fin, c.prof, cab.id
  from candidatos c
  cross join cfg
  cross join necesita_cabina nc
  left join lateral (
    select cb.id
    from public.tratamiento_cabinas tc
    join public.cabinas cb on cb.id = tc.cabina_id and cb.activa
    where tc.tratamiento_id = p_tratamiento_id
      and not exists (
        select 1 from public.citas x
        where x.cabina_id = cb.id
          and x.estado <> 'cancelada'
          and x.franja && tstzrange(c.ini, c.fin, '[)')
      )
    order by cb.nombre, cb.id
    limit 1
  ) cab on nc.si
  where (p_ignorar_antelacion or c.ini >= now() + cfg.antelacion)
    and not exists (
      select 1 from public.citas x
      where x.profesional_id = c.prof
        and x.estado <> 'cancelada'
        and x.franja && tstzrange(c.ini, c.fin, '[)')
    )
    and not exists (
      select 1 from public.ausencias_profesional a
      where a.profesional_id = c.prof
        and tstzrange(a.inicio, a.fin, '[)') && tstzrange(c.ini, c.fin, '[)')
    )
    and (not nc.si or cab.id is not null)
  order by c.ini, c.prof;
$$;

-- -----------------------------------------------------------------------------
-- Reservar una cita.
--   * Web y asistente (sin sesión, desde el servidor): solo en huecos libres.
--   * Panel (admin): puede "forzar" una cita fuera de horario; aun así nunca
--     puede solaparse con otra (lo impide la restricción de la tabla).
-- Errores (código P0001, campo hint):
--   HUECO_NO_DISPONIBLE, HUECO_OCUPADO, SIN_CABINA
-- -----------------------------------------------------------------------------
create or replace function public.reservar_cita(
  p_clinica_id uuid,
  p_clienta_id uuid,
  p_tratamiento_id uuid,
  p_inicio timestamptz,
  p_profesional_id uuid default null,
  p_origen text default 'panel',
  p_cabina_id uuid default null,
  p_forzar boolean default false,
  p_estado text default 'pendiente',
  p_notas text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_tz text;
  v_duracion integer;
  v_reservable_online boolean;
  v_fin timestamptz;
  v_dia date;
  v_fuera_horario boolean := false;
  v_cabina uuid;
  v_id uuid;
  v_hueco record;
begin
  -- Permisos
  if v_uid is not null then
    if not public.es_admin_de(p_clinica_id) then
      raise exception 'No tienes permiso para reservar en esta clínica' using errcode = '42501';
    end if;
    if p_origen <> 'panel' then
      raise exception 'Origen de reserva no válido' using errcode = '22023';
    end if;
  elsif p_forzar or p_origen = 'panel' then
    raise exception 'Solo el panel de la clínica puede forzar una cita' using errcode = '42501';
  end if;

  if p_estado not in ('pendiente', 'confirmada') then
    raise exception 'Una cita nueva solo puede estar pendiente o confirmada' using errcode = '22023';
  end if;

  select c.zona_horaria into v_tz
  from public.clinicas c
  where c.id = p_clinica_id and c.activa;
  if not found then
    raise exception 'La clínica no existe o está desactivada' using errcode = 'P0002';
  end if;

  select t.duracion_min, t.reservable_online into v_duracion, v_reservable_online
  from public.tratamientos t
  where t.id = p_tratamiento_id and t.clinica_id = p_clinica_id and t.activo;
  if not found then
    raise exception 'Ese tratamiento no está disponible' using errcode = 'P0002';
  end if;
  if p_origen = 'web' and not v_reservable_online then
    raise exception 'Ese tratamiento no se puede reservar online' using errcode = '22023';
  end if;

  perform 1 from public.clientas cl
  where cl.id = p_clienta_id and cl.clinica_id = p_clinica_id and cl.anonimizada_at is null;
  if not found then
    raise exception 'No se encuentra la clienta' using errcode = 'P0002';
  end if;

  v_fin := p_inicio + make_interval(mins => v_duracion);
  v_dia := (p_inicio at time zone v_tz)::date;
  if p_origen in ('web', 'asistente') then
    v_fuera_horario := not public.clinica_abierta_en(p_clinica_id, now());
  end if;

  if not p_forzar then
    -- Probamos los huecos libres a esa hora, empezando por la profesional con
    -- menos citas ese día. Si otra reserva simultánea nos quita uno, probamos el siguiente.
    for v_hueco in
      select h.profesional_id, h.cabina_id
      from public.huecos_libres(p_clinica_id, p_tratamiento_id, p_profesional_id, v_dia, v_dia, v_uid is not null) h
      where h.inicio = p_inicio
      order by (
        select count(*) from public.citas x
        where x.profesional_id = h.profesional_id
          and x.estado <> 'cancelada'
          and (x.inicio at time zone v_tz)::date = v_dia
      ), h.profesional_id
    loop
      begin
        insert into public.citas (
          clinica_id, clienta_id, tratamiento_id, profesional_id, cabina_id,
          inicio, fin, estado, origen, reservada_fuera_de_horario, notas, creada_por
        ) values (
          p_clinica_id, p_clienta_id, p_tratamiento_id, v_hueco.profesional_id, v_hueco.cabina_id,
          p_inicio, v_fin, p_estado, p_origen, v_fuera_horario, p_notas, v_uid
        )
        returning id into v_id;
        return v_id;
      exception when exclusion_violation then
        -- Alguien ha cogido este hueco a la vez: probamos el siguiente candidato.
        null;
      end;
    end loop;

    raise exception 'Ese hueco ya no está disponible. Elige otro, por favor.'
      using errcode = 'P0001', hint = 'HUECO_NO_DISPONIBLE';
  end if;

  -- Cita forzada desde el panel
  if p_profesional_id is null then
    raise exception 'Elige una profesional' using errcode = '22023';
  end if;

  v_cabina := p_cabina_id;
  if v_cabina is null and exists (
    select 1 from public.tratamiento_cabinas tc where tc.tratamiento_id = p_tratamiento_id
  ) then
    select cb.id into v_cabina
    from public.tratamiento_cabinas tc
    join public.cabinas cb on cb.id = tc.cabina_id and cb.activa
    where tc.tratamiento_id = p_tratamiento_id
      and not exists (
        select 1 from public.citas x
        where x.cabina_id = cb.id
          and x.estado <> 'cancelada'
          and x.franja && tstzrange(p_inicio, v_fin, '[)')
      )
    order by cb.nombre, cb.id
    limit 1;
    if v_cabina is null then
      raise exception 'No hay ninguna cabina libre para este tratamiento a esa hora'
        using errcode = 'P0001', hint = 'SIN_CABINA';
    end if;
  end if;

  begin
    insert into public.citas (
      clinica_id, clienta_id, tratamiento_id, profesional_id, cabina_id,
      inicio, fin, estado, origen, reservada_fuera_de_horario, notas, creada_por
    ) values (
      p_clinica_id, p_clienta_id, p_tratamiento_id, p_profesional_id, v_cabina,
      p_inicio, v_fin, p_estado, p_origen, v_fuera_horario, p_notas, v_uid
    )
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Esa hora se cruza con otra cita de la profesional o de la cabina'
      using errcode = 'P0001', hint = 'HUECO_OCUPADO';
  end;
  return v_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Mover una cita (solo admin desde el panel). Recalcula el fin con la duración
-- del tratamiento y busca cabina si la actual no está libre.
-- -----------------------------------------------------------------------------
create or replace function public.mover_cita(
  p_cita_id uuid,
  p_inicio timestamptz,
  p_profesional_id uuid default null,
  p_cabina_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cita public.citas;
  v_fin timestamptz;
  v_cabina uuid;
begin
  select * into v_cita from public.citas where id = p_cita_id;
  if not found then
    raise exception 'No se encuentra la cita' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.es_admin_de(v_cita.clinica_id) then
    raise exception 'No tienes permiso para mover esta cita' using errcode = '42501';
  end if;
  if v_cita.estado = 'cancelada' then
    raise exception 'No se puede mover una cita cancelada' using errcode = '22023';
  end if;

  select p_inicio + make_interval(mins => t.duracion_min) into v_fin
  from public.tratamientos t where t.id = v_cita.tratamiento_id;

  v_cabina := coalesce(p_cabina_id, v_cita.cabina_id);
  -- Si la cabina actual está ocupada a la nueva hora, buscamos otra válida.
  if p_cabina_id is null and v_cabina is not null and exists (
    select 1 from public.citas x
    where x.cabina_id = v_cabina and x.id <> p_cita_id and x.estado <> 'cancelada'
      and x.franja && tstzrange(p_inicio, v_fin, '[)')
  ) then
    select cb.id into v_cabina
    from public.tratamiento_cabinas tc
    join public.cabinas cb on cb.id = tc.cabina_id and cb.activa
    where tc.tratamiento_id = v_cita.tratamiento_id
      and not exists (
        select 1 from public.citas x
        where x.cabina_id = cb.id and x.id <> p_cita_id and x.estado <> 'cancelada'
          and x.franja && tstzrange(p_inicio, v_fin, '[)')
      )
    order by cb.nombre, cb.id
    limit 1;
    if v_cabina is null then
      raise exception 'No hay ninguna cabina libre para este tratamiento a esa hora'
        using errcode = 'P0001', hint = 'SIN_CABINA';
    end if;
  end if;

  begin
    update public.citas
    set inicio = p_inicio,
        fin = v_fin,
        profesional_id = coalesce(p_profesional_id, v_cita.profesional_id),
        cabina_id = v_cabina,
        recordatorio_enviado_at = null
    where id = p_cita_id;
  exception when exclusion_violation then
    raise exception 'Esa hora se cruza con otra cita de la profesional o de la cabina'
      using errcode = 'P0001', hint = 'HUECO_OCUPADO';
  end;
end;
$$;

-- -----------------------------------------------------------------------------
-- Derecho de supresión (RGPD): borra los datos personales de la clienta y deja
-- sus citas pasadas sin nombre para que las estadísticas no cambien.
-- -----------------------------------------------------------------------------
create or replace function public.anonimizar_clienta(p_clienta_id uuid, p_solicitud_id uuid default null)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_cli public.clientas;
begin
  select * into v_cli from public.clientas where id = p_clienta_id;
  if not found then
    raise exception 'No se encuentra la clienta' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.es_admin_de(v_cli.clinica_id) then
    raise exception 'No tienes permiso para borrar los datos de esta clienta' using errcode = '42501';
  end if;
  if v_cli.anonimizada_at is not null then
    return;
  end if;

  -- Sus citas futuras se cancelan; las pasadas se quedan sin notas.
  update public.citas
  set estado = 'cancelada', cancelada_por = 'clinica'
  where clienta_id = p_clienta_id and estado in ('pendiente', 'confirmada') and inicio > now();
  update public.citas set notas = null where clienta_id = p_clienta_id;

  delete from public.notas_clinicas where clienta_id = p_clienta_id;
  -- Conversaciones de WhatsApp (los mensajes se borran en cascada)
  delete from public.conversaciones
  where clinica_id = v_cli.clinica_id
    and (clienta_id = p_clienta_id or (v_cli.telefono is not null and telefono = v_cli.telefono));
  update public.avisos set detalle = null where clienta_id = p_clienta_id;
  update public.clientas set contacto_principal_id = null where contacto_principal_id = p_clienta_id;

  update public.clientas
  set nombre = 'Clienta eliminada',
      telefono = null,
      email = null,
      notas_asistente = null,
      consentimiento_privacidad_at = null,
      consentimiento_via = null,
      contacto_principal_id = null,
      anonimizada_at = now()
  where id = p_clienta_id;

  -- Constancia de la petición y de cuándo se resolvió
  if p_solicitud_id is not null then
    update public.solicitudes_rgpd
    set resuelta_at = now(), resuelta_por = auth.uid()
    where id = p_solicitud_id and clinica_id = v_cli.clinica_id;
  else
    insert into public.solicitudes_rgpd (clinica_id, clienta_id, tipo, via, detalle, resuelta_at, resuelta_por)
    values (v_cli.clinica_id, p_clienta_id, 'supresion', 'panel', 'Borrado de datos desde el panel', now(), auth.uid());
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- Fusionar dos fichas duplicadas: todo pasa a p_conservar y p_eliminar desaparece.
-- -----------------------------------------------------------------------------
create or replace function public.fusionar_clientas(p_conservar uuid, p_eliminar uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_c public.clientas;
  v_e public.clientas;
  v_nota_e text;
begin
  if p_conservar = p_eliminar then
    raise exception 'Elige dos fichas distintas' using errcode = '22023';
  end if;
  select * into v_c from public.clientas where id = p_conservar;
  select * into v_e from public.clientas where id = p_eliminar;
  if v_c.id is null or v_e.id is null or v_c.clinica_id <> v_e.clinica_id then
    raise exception 'No se encuentran las dos fichas en la misma clínica' using errcode = 'P0002';
  end if;
  if auth.uid() is not null and not public.es_admin_de(v_c.clinica_id) then
    raise exception 'No tienes permiso para fusionar fichas' using errcode = '42501';
  end if;
  if v_c.anonimizada_at is not null or v_e.anonimizada_at is not null then
    raise exception 'No se pueden fusionar fichas anonimizadas' using errcode = '22023';
  end if;

  -- Liberamos el teléfono de la ficha que desaparece por si pasa a la otra
  update public.clientas set telefono = null where id = p_eliminar;
  if v_c.contacto_principal_id = p_eliminar then
    update public.clientas set contacto_principal_id = null where id = p_conservar;
  end if;

  update public.citas set clienta_id = p_conservar where clienta_id = p_eliminar;
  update public.conversaciones set clienta_id = p_conservar where clienta_id = p_eliminar;
  update public.avisos set clienta_id = p_conservar where clienta_id = p_eliminar;
  update public.solicitudes_rgpd set clienta_id = p_conservar where clienta_id = p_eliminar;
  update public.clientas set contacto_principal_id = p_conservar
  where contacto_principal_id = p_eliminar and id <> p_conservar;

  select texto into v_nota_e from public.notas_clinicas where clienta_id = p_eliminar;
  if v_nota_e is not null and btrim(v_nota_e) <> '' then
    insert into public.notas_clinicas (clienta_id, clinica_id, texto, updated_by)
    values (p_conservar, v_c.clinica_id, v_nota_e, auth.uid())
    on conflict (clienta_id) do update
      set texto = concat_ws(E'\n\n', nullif(public.notas_clinicas.texto, ''), excluded.texto),
          updated_by = excluded.updated_by;
  end if;

  update public.clientas
  set telefono = coalesce(v_c.telefono, v_e.telefono),
      email = coalesce(v_c.email, v_e.email),
      notas_asistente = nullif(concat_ws(E'\n', v_c.notas_asistente, v_e.notas_asistente), ''),
      consentimiento_privacidad_at = coalesce(v_c.consentimiento_privacidad_at, v_e.consentimiento_privacidad_at),
      consentimiento_via = case
        when v_c.consentimiento_privacidad_at is not null then v_c.consentimiento_via
        else v_e.consentimiento_via
      end
  where id = p_conservar;

  delete from public.clientas where id = p_eliminar;
end;
$$;

-- -----------------------------------------------------------------------------
-- Permisos de ejecución: nunca para el visitante anónimo.
-- -----------------------------------------------------------------------------
revoke execute on function public.clinica_abierta_en(uuid, timestamptz) from public, anon;
revoke execute on function public.huecos_libres(uuid, uuid, uuid, date, date, boolean) from public, anon;
revoke execute on function public.reservar_cita(uuid, uuid, uuid, timestamptz, uuid, text, uuid, boolean, text, text) from public, anon;
revoke execute on function public.mover_cita(uuid, timestamptz, uuid, uuid) from public, anon;
revoke execute on function public.anonimizar_clienta(uuid, uuid) from public, anon;
revoke execute on function public.fusionar_clientas(uuid, uuid) from public, anon;

grant execute on function public.clinica_abierta_en(uuid, timestamptz) to authenticated, service_role;
grant execute on function public.huecos_libres(uuid, uuid, uuid, date, date, boolean) to authenticated, service_role;
grant execute on function public.reservar_cita(uuid, uuid, uuid, timestamptz, uuid, text, uuid, boolean, text, text) to authenticated, service_role;
grant execute on function public.mover_cita(uuid, timestamptz, uuid, uuid) to authenticated, service_role;
grant execute on function public.anonimizar_clienta(uuid, uuid) to authenticated, service_role;
grant execute on function public.fusionar_clientas(uuid, uuid) to authenticated, service_role;
