-- =============================================================================
-- Esquema inicial: clínicas, configuración, clientas, citas, WhatsApp y RGPD.
--
-- Reglas que viven aquí (no en la pantalla):
--   * Cada fila de una clínica lleva clinica_id, y las referencias entre tablas
--     son "compuestas" (id + clinica_id): una cita de la clínica A no puede
--     apuntar a una profesional, clienta, cabina o tratamiento de la clínica B.
--   * Dos citas no canceladas no pueden solaparse en la misma profesional ni en
--     la misma cabina (restricciones EXCLUDE).
-- =============================================================================

create extension if not exists btree_gist with schema extensions;

-- Pone updated_at = now() en cada UPDATE.
create or replace function public.poner_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- Clínicas y usuarios
-- -----------------------------------------------------------------------------

create table public.clinicas (
  id uuid primary key default gen_random_uuid(),
  nombre text not null check (length(btrim(nombre)) > 0),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  direccion text,
  telefono text,
  email text,
  zona_horaria text not null default 'Europe/Madrid'
    check (zona_horaria in ('Europe/Madrid', 'Atlantic/Canary')),
  activa boolean not null default true,
  -- Una clínica demo nunca envía WhatsApp a sus clientas (pueden ser números de otra persona).
  es_demo boolean not null default false,
  whatsapp_phone_number_id text unique,
  whatsapp_numero_visible text,
  tono_asistente text not null default 'Cercano y profesional. Tutea a la clienta y usa un lenguaje sencillo.',
  instrucciones_extra_asistente text,
  url_politica_privacidad text,
  intervalo_huecos_min integer not null default 15 check (intervalo_huecos_min in (5, 10, 15, 20, 30, 60)),
  antelacion_minima_reserva_min integer not null default 120 check (antelacion_minima_reserva_min >= 0),
  horas_minimas_cancelacion integer not null default 24 check (horas_minimas_cancelacion >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger clinicas_updated_at before update on public.clinicas
  for each row execute function public.poner_updated_at();

create table public.superadmins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

create table public.profesionales (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  color text not null default '#c084fc' check (color ~ '^#[0-9a-fA-F]{6}$'),
  activa boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinica_id)
);
create index on public.profesionales (clinica_id);
create trigger profesionales_updated_at before update on public.profesionales
  for each row execute function public.poner_updated_at();

create table public.miembros (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  rol text not null check (rol in ('admin', 'profesional')),
  profesional_id uuid,
  created_at timestamptz not null default now(),
  unique (user_id, clinica_id),
  foreign key (profesional_id, clinica_id) references public.profesionales (id, clinica_id) on delete cascade,
  check (rol = 'admin' or profesional_id is not null)
);
create index on public.miembros (clinica_id);

-- -----------------------------------------------------------------------------
-- Horarios y cierres
-- dia_semana: 1 = lunes ... 7 = domingo (ISO)
-- -----------------------------------------------------------------------------

create table public.horarios_clinica (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_inicio time not null,
  hora_fin time not null,
  check (hora_fin > hora_inicio)
);
create index on public.horarios_clinica (clinica_id, dia_semana);

create table public.cierres_clinica (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  fecha_inicio date not null,
  fecha_fin date not null,
  motivo text,
  check (fecha_fin >= fecha_inicio)
);
create index on public.cierres_clinica (clinica_id, fecha_inicio);

create table public.horarios_profesional (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null,
  profesional_id uuid not null,
  dia_semana smallint not null check (dia_semana between 1 and 7),
  hora_inicio time not null,
  hora_fin time not null,
  check (hora_fin > hora_inicio),
  foreign key (profesional_id, clinica_id) references public.profesionales (id, clinica_id) on delete cascade
);
create index on public.horarios_profesional (profesional_id, dia_semana);

create table public.ausencias_profesional (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null,
  profesional_id uuid not null,
  inicio timestamptz not null,
  fin timestamptz not null,
  motivo text,
  check (fin > inicio),
  foreign key (profesional_id, clinica_id) references public.profesionales (id, clinica_id) on delete cascade
);
create index on public.ausencias_profesional (profesional_id, inicio);

-- -----------------------------------------------------------------------------
-- Cabinas y tratamientos
-- -----------------------------------------------------------------------------

create table public.cabinas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  activa boolean not null default true,
  created_at timestamptz not null default now(),
  unique (id, clinica_id)
);
create index on public.cabinas (clinica_id);

create table public.tratamientos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  descripcion text,
  duracion_min integer not null check (duracion_min between 5 and 480),
  precio numeric(10, 2) check (precio >= 0),
  precio_desde boolean not null default false,
  preparacion text,
  cuidados_posteriores text,
  sesiones_recomendadas integer check (sesiones_recomendadas >= 1),
  contraindicaciones text,
  -- Lista de {"pregunta": "...", "respuesta": "..."}
  preguntas_frecuentes jsonb not null default '[]'::jsonb check (jsonb_typeof(preguntas_frecuentes) = 'array'),
  activo boolean not null default true,
  reservable_online boolean not null default true,
  orden integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinica_id)
);
create index on public.tratamientos (clinica_id);
create trigger tratamientos_updated_at before update on public.tratamientos
  for each row execute function public.poner_updated_at();

-- Qué profesionales hacen cada tratamiento
create table public.tratamiento_profesionales (
  clinica_id uuid not null,
  tratamiento_id uuid not null,
  profesional_id uuid not null,
  primary key (tratamiento_id, profesional_id),
  foreign key (tratamiento_id, clinica_id) references public.tratamientos (id, clinica_id) on delete cascade,
  foreign key (profesional_id, clinica_id) references public.profesionales (id, clinica_id) on delete cascade
);
create index on public.tratamiento_profesionales (profesional_id);

-- En qué cabinas se puede hacer cada tratamiento (sin filas = no necesita cabina)
create table public.tratamiento_cabinas (
  clinica_id uuid not null,
  tratamiento_id uuid not null,
  cabina_id uuid not null,
  primary key (tratamiento_id, cabina_id),
  foreign key (tratamiento_id, clinica_id) references public.tratamientos (id, clinica_id) on delete cascade,
  foreign key (cabina_id, clinica_id) references public.cabinas (id, clinica_id) on delete cascade
);
create index on public.tratamiento_cabinas (cabina_id);

-- -----------------------------------------------------------------------------
-- Clientas
-- -----------------------------------------------------------------------------

create table public.clientas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  nombre text not null check (length(btrim(nombre)) > 0),
  -- Formato internacional E.164: +34600111222
  telefono text check (telefono ~ '^\+[1-9][0-9]{6,14}$'),
  email text,
  -- Preferencias sin datos de salud. Las usa el asistente; nunca se le leen a la clienta.
  notas_asistente text,
  consentimiento_privacidad_at timestamptz,
  consentimiento_via text check (consentimiento_via in ('web', 'whatsapp', 'panel', 'importacion')),
  origen text not null default 'panel' check (origen in ('web', 'whatsapp', 'panel', 'importacion')),
  -- Si se reservó desde el teléfono de otra persona (madre/hija), su ficha principal
  contacto_principal_id uuid,
  anonimizada_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, clinica_id),
  foreign key (contacto_principal_id, clinica_id) references public.clientas (id, clinica_id)
    on delete set null (contacto_principal_id),
  check (contacto_principal_id is null or contacto_principal_id <> id)
);
create unique index clientas_telefono_unico on public.clientas (clinica_id, telefono) where telefono is not null;
create index on public.clientas (clinica_id, nombre);
create trigger clientas_updated_at before update on public.clientas
  for each row execute function public.poner_updated_at();

-- Tabla aparte a propósito: el código del asistente de IA nunca lee esta tabla.
create table public.notas_clinicas (
  clienta_id uuid primary key,
  clinica_id uuid not null,
  texto text not null default '',
  updated_at timestamptz not null default now(),
  updated_by uuid references auth.users (id) on delete set null,
  foreign key (clienta_id, clinica_id) references public.clientas (id, clinica_id) on delete cascade
);
create trigger notas_clinicas_updated_at before update on public.notas_clinicas
  for each row execute function public.poner_updated_at();

-- -----------------------------------------------------------------------------
-- Citas
-- -----------------------------------------------------------------------------

create table public.citas (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  clienta_id uuid not null,
  tratamiento_id uuid not null,
  profesional_id uuid not null,
  cabina_id uuid,
  inicio timestamptz not null,
  fin timestamptz not null,
  franja tstzrange generated always as (tstzrange(inicio, fin, '[)')) stored,
  estado text not null default 'pendiente'
    check (estado in ('pendiente', 'confirmada', 'cancelada', 'no_presentada', 'completada')),
  origen text not null default 'panel' check (origen in ('panel', 'web', 'asistente', 'importacion')),
  -- Para el informe: la reserva se hizo con la clínica cerrada
  reservada_fuera_de_horario boolean not null default false,
  notas text,
  confirmada_at timestamptz,
  cancelada_at timestamptz,
  cancelada_por text check (cancelada_por in ('clienta', 'clinica', 'asistente')),
  recordatorio_enviado_at timestamptz,
  creada_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (fin > inicio),
  foreign key (clienta_id, clinica_id) references public.clientas (id, clinica_id),
  foreign key (tratamiento_id, clinica_id) references public.tratamientos (id, clinica_id),
  foreign key (profesional_id, clinica_id) references public.profesionales (id, clinica_id),
  foreign key (cabina_id, clinica_id) references public.cabinas (id, clinica_id),
  -- REGLA ANTI-SOLAPAMIENTO: la base de datos rechaza la segunda cita.
  constraint citas_sin_solape_profesional
    exclude using gist (profesional_id with =, franja with &&) where (estado <> 'cancelada'),
  constraint citas_sin_solape_cabina
    exclude using gist (cabina_id with =, franja with &&) where (estado <> 'cancelada' and cabina_id is not null)
);
create index on public.citas (clinica_id, inicio);
create index on public.citas (clienta_id, inicio);
create index on public.citas (profesional_id, inicio);
create trigger citas_updated_at before update on public.citas
  for each row execute function public.poner_updated_at();

-- -----------------------------------------------------------------------------
-- WhatsApp y asistente (se usan a partir de la fase c)
-- -----------------------------------------------------------------------------

create table public.conversaciones (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  clienta_id uuid,
  telefono text not null check (telefono ~ '^\+[1-9][0-9]{6,14}$'),
  modo text not null default 'asistente' check (modo in ('asistente', 'persona')),
  pausada_por uuid references auth.users (id) on delete set null,
  ultimo_mensaje_at timestamptz,
  -- Para la ventana de 24 h de Meta
  ultimo_mensaje_clienta_at timestamptz,
  no_leidos integer not null default 0,
  created_at timestamptz not null default now(),
  unique (id, clinica_id),
  unique (clinica_id, telefono),
  foreign key (clienta_id, clinica_id) references public.clientas (id, clinica_id)
    on delete set null (clienta_id)
);

create table public.mensajes (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null,
  conversacion_id uuid not null,
  direccion text not null check (direccion in ('entrante', 'saliente')),
  autor text not null check (autor in ('clienta', 'asistente', 'personal', 'sistema')),
  texto text,
  tipo text not null default 'texto' check (tipo in ('texto', 'plantilla', 'boton', 'otro')),
  plantilla text,
  wa_message_id text unique,
  estado_entrega text,
  iniciado_por_negocio boolean not null default false,
  dentro_ventana boolean,
  enviado_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (conversacion_id, clinica_id) references public.conversaciones (id, clinica_id) on delete cascade
);
create index on public.mensajes (conversacion_id, created_at);
create index on public.mensajes (clinica_id, created_at);

create table public.avisos (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  tipo text not null check (tipo in (
    'pide_persona', 'queja', 'pregunta_sin_respuesta', 'datos_no_coinciden',
    'solicitud_supresion', 'solicitud_acceso', 'otro')),
  detalle text,
  conversacion_id uuid,
  clienta_id uuid,
  resuelto_at timestamptz,
  resuelto_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  foreign key (conversacion_id, clinica_id) references public.conversaciones (id, clinica_id)
    on delete set null (conversacion_id),
  foreign key (clienta_id, clinica_id) references public.clientas (id, clinica_id)
    on delete set null (clienta_id)
);
create index on public.avisos (clinica_id, created_at);

create table public.solicitudes_rgpd (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  clienta_id uuid,
  tipo text not null check (tipo in ('supresion', 'acceso')),
  via text not null check (via in ('whatsapp', 'panel', 'email', 'otro')),
  detalle text,
  solicitada_at timestamptz not null default now(),
  resuelta_at timestamptz,
  resuelta_por uuid references auth.users (id) on delete set null,
  foreign key (clienta_id, clinica_id) references public.clientas (id, clinica_id)
    on delete set null (clienta_id)
);
create index on public.solicitudes_rgpd (clinica_id, solicitada_at);

create table public.uso_ia (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  conversacion_id uuid,
  modelo text not null,
  tokens_entrada integer not null default 0,
  tokens_salida integer not null default 0,
  tokens_cache_lectura integer not null default 0,
  tokens_cache_escritura integer not null default 0,
  created_at timestamptz not null default now(),
  foreign key (conversacion_id, clinica_id) references public.conversaciones (id, clinica_id)
    on delete set null (conversacion_id)
);
create index on public.uso_ia (clinica_id, created_at);

create table public.importaciones (
  id uuid primary key default gen_random_uuid(),
  clinica_id uuid not null references public.clinicas (id) on delete cascade,
  archivo_nombre text,
  filas_importadas integer not null default 0,
  filas_con_error integer not null default 0,
  errores jsonb not null default '[]'::jsonb,
  creada_por uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now()
);
