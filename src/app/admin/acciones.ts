"use server";

import { revalidatePath } from "next/cache";
import { esSuperadmin, requerirUsuario } from "@/lib/sesion";
import { ErrorUsuario, errorAccion, mensajeDeError, type EstadoAccion } from "@/lib/errores";
import { invitarAClinica } from "@/lib/invitaciones";

async function requerirSuperadmin() {
  const ctx = await requerirUsuario();
  if (!(await esSuperadmin())) throw new ErrorUsuario("Solo el superadmin puede hacer esto.");
  return ctx;
}

/** "Clínica Bella Piel Málaga" -> "clinica-bella-piel-malaga" */
function crearSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 60);
}

export async function crearClinica(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    const { supabase } = await requerirSuperadmin();
    const nombre = String(datos.get("nombre") ?? "").trim();
    const slug = crearSlug(String(datos.get("slug") ?? "") || nombre);
    const zona = String(datos.get("zona_horaria") ?? "Europe/Madrid");
    const emailAdmin = String(datos.get("email_admin") ?? "").trim();
    if (!nombre) return { error: "Escribe el nombre de la clínica." };
    if (!slug) return { error: "La dirección web no es válida." };

    const { data: clinica, error } = await supabase
      .from("clinicas")
      .insert({ nombre, slug, zona_horaria: zona })
      .select("id")
      .single();
    if (error) return { error: mensajeDeError(error) };

    let mensaje = `Clínica creada. Su dirección es /clinica/${slug}.`;
    if (emailAdmin) {
      const r = await invitarAClinica({ clinicaId: clinica.id, email: emailAdmin, rol: "admin" });
      mensaje += r === "invitada" ? ` Invitación enviada a ${emailAdmin}.` : ` ${emailAdmin} ya tenía cuenta y se ha añadido como admin.`;
    }
    revalidatePath("/admin");
    return { ok: true, mensaje };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function cambiarEstadoClinica(clinicaId: string, activa: boolean) {
  const { supabase } = await requerirSuperadmin();
  await supabase.from("clinicas").update({ activa }).eq("id", clinicaId);
  revalidatePath("/admin");
}

export async function invitarAdmin(clinicaId: string, _: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  try {
    await requerirSuperadmin();
    const email = String(datos.get("email") ?? "");
    const r = await invitarAClinica({ clinicaId, email, rol: "admin" });
    revalidatePath("/admin");
    return {
      ok: true,
      mensaje: r === "invitada" ? "Invitación enviada." : "Esa persona ya tenía cuenta: se ha añadido como admin.",
    };
  } catch (e) {
    return errorAccion(e);
  }
}
