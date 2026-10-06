-- =============================================================================
-- Equipo de cada clínica: ver los emails de los miembros e invitar usuarios.
-- Los emails están en el esquema "auth", que no se expone directamente.
-- =============================================================================

-- Busca el id de un usuario por su email. Solo para el servidor (clave de servicio).
create or replace function public.usuario_id_por_email(p_email text)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select u.id from auth.users u where lower(u.email) = lower(btrim(p_email)) limit 1;
$$;
revoke execute on function public.usuario_id_por_email(text) from public, anon, authenticated;
grant execute on function public.usuario_id_por_email(text) to service_role;

-- Miembros de una clínica con su email (solo para su admin o el superadmin)
create or replace function public.listar_equipo(p_clinica_id uuid)
returns table (
  miembro_id uuid,
  user_id uuid,
  email text,
  rol text,
  profesional_id uuid,
  ha_entrado boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select m.id, m.user_id, u.email::text, m.rol, m.profesional_id, u.last_sign_in_at is not null
  from public.miembros m
  join auth.users u on u.id = m.user_id
  where m.clinica_id = p_clinica_id
    and public.es_admin_de(p_clinica_id)
  order by m.rol, u.email;
$$;
revoke execute on function public.listar_equipo(uuid) from public, anon;
grant execute on function public.listar_equipo(uuid) to authenticated, service_role;
