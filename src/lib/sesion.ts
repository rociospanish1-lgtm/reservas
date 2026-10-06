import "server-only";
import { cache } from "react";
import { notFound, redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { ErrorUsuario } from "@/lib/errores";
import type { Clinica, Rol } from "@/lib/tipos";

/** Usuario con sesión iniciada (o null). Se calcula una vez por petición. */
export const obtenerUsuario = cache(async () => {
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  return { supabase, usuario: data.user };
});

export async function requerirUsuario() {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) redirect("/login");
  return { supabase, usuario };
}

export const esSuperadmin = cache(async (): Promise<boolean> => {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) return false;
  const { data } = await supabase.rpc("es_superadmin");
  return data === true;
});

/**
 * Datos de la clínica de la URL y el papel del usuario en ella.
 * Si el usuario no pertenece a esa clínica, la seguridad por filas no le
 * devuelve la clínica y se muestra "no encontrada".
 */
export const obtenerContextoClinica = cache(async (slug: string) => {
  const { supabase, usuario } = await requerirUsuario();
  const { data: clinica } = await supabase.from("clinicas").select("*").eq("slug", slug).maybeSingle<Clinica>();
  if (!clinica) notFound();

  const superadmin = await esSuperadmin();
  const { data: miembro } = await supabase
    .from("miembros")
    .select("rol, profesional_id")
    .eq("clinica_id", clinica.id)
    .eq("user_id", usuario.id)
    .maybeSingle<{ rol: Rol; profesional_id: string | null }>();

  const rol: Rol | null = superadmin ? "admin" : (miembro?.rol ?? null);
  if (!rol) notFound();

  return {
    supabase,
    usuario,
    clinica,
    rol,
    esAdmin: rol === "admin",
    superadmin,
    profesionalId: superadmin ? null : (miembro?.profesional_id ?? null),
  };
});

/** Para acciones que solo puede hacer la administración de la clínica */
export async function requerirAdmin(slug: string) {
  const ctx = await obtenerContextoClinica(slug);
  if (!ctx.esAdmin) throw new ErrorUsuario("Solo la administración de la clínica puede hacer esto.");
  return ctx;
}

/** Para páginas que solo puede ver la administración */
export async function requerirAdminPagina(slug: string) {
  const ctx = await obtenerContextoClinica(slug);
  if (!ctx.esAdmin) redirect(`/clinica/${slug}/agenda`);
  return ctx;
}
