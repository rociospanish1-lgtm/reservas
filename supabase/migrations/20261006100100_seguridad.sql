-- =============================================================================
-- Seguridad por filas (RLS): cada clínica solo ve lo suyo.
--
-- Roles:
--   * superadmin  -> tabla superadmins. Ve y gestiona todo.
--   * admin       -> miembros.rol = 'admin'. Gestiona su clínica.
--   * profesional -> miembros.rol = 'profesional'. Ve su agenda y sus clientas.
--   * visitante sin sesión (anon) -> no puede leer ni escribir ninguna tabla.
--
-- Las funciones de ayuda son SECURITY DEFINER para poder consultar "miembros"
-- sin entrar en bucle con sus propias políticas.
-- Los miembros de una clínica desactivada pierden el acceso (el superadmin no).
-- =============================================================================

create or replace function public.es_superadmin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (select 1 from public.superadmins s where s.user_id = auth.uid());
$$;

create or replace function public.es_miembro_de(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_superadmin() or exists (
    select 1
    from public.miembros m
    join public.clinicas c on c.id = m.clinica_id
    where m.user_id = auth.uid() and m.clinica_id = p_clinica_id and c.activa
  );
$$;

create or replace function public.es_admin_de(p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select public.es_superadmin() or exists (
    select 1
    from public.miembros m
    join public.clinicas c on c.id = m.clinica_id
    where m.user_id = auth.uid() and m.clinica_id = p_clinica_id and m.rol = 'admin' and c.activa
  );
$$;

-- La ficha de profesional del usuario actual en esa clínica (null si no es profesional)
create or replace function public.mi_profesional_id(p_clinica_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.profesional_id
  from public.miembros m
  join public.clinicas c on c.id = m.clinica_id
  where m.user_id = auth.uid() and m.clinica_id = p_clinica_id and m.rol = 'profesional' and c.activa;
$$;

-- ¿La profesional actual tiene o ha tenido alguna cita con esta clienta?
create or replace function public.atiendo_a_clienta(p_clienta_id uuid, p_clinica_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.citas ci
    where ci.clienta_id = p_clienta_id
      and ci.clinica_id = p_clinica_id
      and ci.profesional_id = public.mi_profesional_id(p_clinica_id)
  );
$$;

revoke execute on function public.es_superadmin() from public, anon;
revoke execute on function public.es_miembro_de(uuid) from public, anon;
revoke execute on function public.es_admin_de(uuid) from public, anon;
revoke execute on function public.mi_profesional_id(uuid) from public, anon;
revoke execute on function public.atiendo_a_clienta(uuid, uuid) from public, anon;
grant execute on function public.es_superadmin() to authenticated, service_role;
grant execute on function public.es_miembro_de(uuid) to authenticated, service_role;
grant execute on function public.es_admin_de(uuid) to authenticated, service_role;
grant execute on function public.mi_profesional_id(uuid) to authenticated, service_role;
grant execute on function public.atiendo_a_clienta(uuid, uuid) to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Activar RLS en todas las tablas. Sin política = acceso denegado.
-- -----------------------------------------------------------------------------
alter table public.clinicas enable row level security;
alter table public.superadmins enable row level security;
alter table public.miembros enable row level security;
alter table public.profesionales enable row level security;
alter table public.horarios_clinica enable row level security;
alter table public.cierres_clinica enable row level security;
alter table public.horarios_profesional enable row level security;
alter table public.ausencias_profesional enable row level security;
alter table public.cabinas enable row level security;
alter table public.tratamientos enable row level security;
alter table public.tratamiento_profesionales enable row level security;
alter table public.tratamiento_cabinas enable row level security;
alter table public.clientas enable row level security;
alter table public.notas_clinicas enable row level security;
alter table public.citas enable row level security;
alter table public.conversaciones enable row level security;
alter table public.mensajes enable row level security;
alter table public.avisos enable row level security;
alter table public.solicitudes_rgpd enable row level security;
alter table public.uso_ia enable row level security;
alter table public.importaciones enable row level security;

-- El visitante sin sesión no tiene ningún permiso directo sobre las tablas.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- -----------------------------------------------------------------------------
-- Clínicas
-- -----------------------------------------------------------------------------
create policy "clinicas: leer las mías" on public.clinicas
  for select to authenticated using (public.es_miembro_de(id));
create policy "clinicas: crear (superadmin)" on public.clinicas
  for insert to authenticated with check (public.es_superadmin());
create policy "clinicas: editar (admin)" on public.clinicas
  for update to authenticated using (public.es_admin_de(id)) with check (public.es_admin_de(id));
create policy "clinicas: borrar (superadmin)" on public.clinicas
  for delete to authenticated using (public.es_superadmin());

-- Un admin de clínica no puede cambiar los campos que gestiona el superadmin.
create or replace function public.proteger_campos_clinica()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is not null and not public.es_superadmin() then
    if new.activa is distinct from old.activa
       or new.es_demo is distinct from old.es_demo
       or new.slug is distinct from old.slug
       or new.whatsapp_phone_number_id is distinct from old.whatsapp_phone_number_id then
      raise exception 'Solo el superadmin puede cambiar estos datos de la clínica'
        using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
create trigger clinicas_proteger_campos before update on public.clinicas
  for each row execute function public.proteger_campos_clinica();

-- -----------------------------------------------------------------------------
-- Superadmins: cada usuario solo puede ver si él mismo lo es. Nadie escribe por API.
-- -----------------------------------------------------------------------------
create policy "superadmins: verme" on public.superadmins
  for select to authenticated using (user_id = auth.uid());

-- -----------------------------------------------------------------------------
-- Miembros
-- -----------------------------------------------------------------------------
create policy "miembros: leer" on public.miembros
  for select to authenticated using (user_id = auth.uid() or public.es_admin_de(clinica_id));
create policy "miembros: crear (admin)" on public.miembros
  for insert to authenticated with check (public.es_admin_de(clinica_id));
create policy "miembros: editar (admin)" on public.miembros
  for update to authenticated using (public.es_admin_de(clinica_id)) with check (public.es_admin_de(clinica_id));
create policy "miembros: borrar (admin)" on public.miembros
  for delete to authenticated using (public.es_admin_de(clinica_id));

-- -----------------------------------------------------------------------------
-- Configuración: la leen todos los miembros, la cambia el admin.
-- -----------------------------------------------------------------------------
do $$
declare
  t text;
begin
  foreach t in array array[
    'profesionales', 'horarios_clinica', 'cierres_clinica', 'horarios_profesional',
    'ausencias_profesional', 'cabinas', 'tratamientos', 'tratamiento_profesionales',
    'tratamiento_cabinas'
  ] loop
    execute format(
      'create policy %I on public.%I for select to authenticated using (public.es_miembro_de(clinica_id))',
      t || ': leer (miembros)', t);
    execute format(
      'create policy %I on public.%I for insert to authenticated with check (public.es_admin_de(clinica_id))',
      t || ': crear (admin)', t);
    execute format(
      'create policy %I on public.%I for update to authenticated using (public.es_admin_de(clinica_id)) with check (public.es_admin_de(clinica_id))',
      t || ': editar (admin)', t);
    execute format(
      'create policy %I on public.%I for delete to authenticated using (public.es_admin_de(clinica_id))',
      t || ': borrar (admin)', t);
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clientas: el admin ve todas las de su clínica; la profesional, solo las que atiende.
-- No hay política de borrado: se anonimizan con anonimizar_clienta().
-- -----------------------------------------------------------------------------
create policy "clientas: leer" on public.clientas
  for select to authenticated
  using (public.es_admin_de(clinica_id) or public.atiendo_a_clienta(id, clinica_id));
create policy "clientas: crear (admin)" on public.clientas
  for insert to authenticated with check (public.es_admin_de(clinica_id));
create policy "clientas: editar (admin)" on public.clientas
  for update to authenticated using (public.es_admin_de(clinica_id)) with check (public.es_admin_de(clinica_id));

create policy "notas_clinicas: leer" on public.notas_clinicas
  for select to authenticated
  using (public.es_admin_de(clinica_id) or public.atiendo_a_clienta(clienta_id, clinica_id));
create policy "notas_clinicas: crear" on public.notas_clinicas
  for insert to authenticated
  with check (public.es_admin_de(clinica_id) or public.atiendo_a_clienta(clienta_id, clinica_id));
create policy "notas_clinicas: editar" on public.notas_clinicas
  for update to authenticated
  using (public.es_admin_de(clinica_id) or public.atiendo_a_clienta(clienta_id, clinica_id))
  with check (public.es_admin_de(clinica_id) or public.atiendo_a_clienta(clienta_id, clinica_id));

-- -----------------------------------------------------------------------------
-- Citas: el admin, todas las de su clínica; la profesional, solo las suyas.
-- No hay borrado: las citas se cancelan.
-- Las citas nuevas se crean con reservar_cita() (que comprueba horarios).
-- -----------------------------------------------------------------------------
create policy "citas: leer" on public.citas
  for select to authenticated
  using (public.es_admin_de(clinica_id) or profesional_id = public.mi_profesional_id(clinica_id));
create policy "citas: editar" on public.citas
  for update to authenticated
  using (public.es_admin_de(clinica_id) or profesional_id = public.mi_profesional_id(clinica_id))
  with check (public.es_admin_de(clinica_id) or profesional_id = public.mi_profesional_id(clinica_id));

-- Estados automáticos y límites de lo que puede cambiar una profesional.
create or replace function public.antes_de_guardar_cita()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_libres text[] := array['estado', 'notas', 'updated_at', 'confirmada_at', 'franja'];
begin
  if tg_op = 'UPDATE' then
    -- Una profesional (no admin) solo puede cambiar el estado y las notas de su cita,
    -- y no puede cancelarla.
    if auth.uid() is not null and not public.es_admin_de(old.clinica_id) then
      if (to_jsonb(new) - v_libres) <> (to_jsonb(old) - v_libres) then
        raise exception 'Una profesional solo puede cambiar el estado y las notas de su cita'
          using errcode = '42501';
      end if;
      if new.estado = 'cancelada' and old.estado <> 'cancelada' then
        raise exception 'Solo la clínica puede cancelar citas' using errcode = '42501';
      end if;
    end if;
  end if;

  if new.estado = 'confirmada' and new.confirmada_at is null then
    new.confirmada_at := now();
  end if;
  if new.estado = 'cancelada' and new.cancelada_at is null then
    new.cancelada_at := now();
  end if;
  if new.estado <> 'cancelada' then
    new.cancelada_at := null;
    new.cancelada_por := null;
  end if;
  return new;
end;
$$;
create trigger citas_antes_de_guardar before insert or update on public.citas
  for each row execute function public.antes_de_guardar_cita();

-- -----------------------------------------------------------------------------
-- WhatsApp, avisos, RGPD, uso de IA e importaciones: solo el admin.
-- Los mensajes y el uso de IA los escribe el servidor (clave de servicio).
-- -----------------------------------------------------------------------------
create policy "conversaciones: leer (admin)" on public.conversaciones
  for select to authenticated using (public.es_admin_de(clinica_id));
create policy "conversaciones: editar (admin)" on public.conversaciones
  for update to authenticated using (public.es_admin_de(clinica_id)) with check (public.es_admin_de(clinica_id));

create policy "mensajes: leer (admin)" on public.mensajes
  for select to authenticated using (public.es_admin_de(clinica_id));

create policy "avisos: leer (admin)" on public.avisos
  for select to authenticated using (public.es_admin_de(clinica_id));
create policy "avisos: crear (admin)" on public.avisos
  for insert to authenticated with check (public.es_admin_de(clinica_id));
create policy "avisos: editar (admin)" on public.avisos
  for update to authenticated using (public.es_admin_de(clinica_id)) with check (public.es_admin_de(clinica_id));

create policy "solicitudes_rgpd: leer (admin)" on public.solicitudes_rgpd
  for select to authenticated using (public.es_admin_de(clinica_id));
create policy "solicitudes_rgpd: crear (admin)" on public.solicitudes_rgpd
  for insert to authenticated with check (public.es_admin_de(clinica_id));
create policy "solicitudes_rgpd: editar (admin)" on public.solicitudes_rgpd
  for update to authenticated using (public.es_admin_de(clinica_id)) with check (public.es_admin_de(clinica_id));

create policy "uso_ia: leer (admin)" on public.uso_ia
  for select to authenticated using (public.es_admin_de(clinica_id));

create policy "importaciones: leer (admin)" on public.importaciones
  for select to authenticated using (public.es_admin_de(clinica_id));
create policy "importaciones: crear (admin)" on public.importaciones
  for insert to authenticated with check (public.es_admin_de(clinica_id));
