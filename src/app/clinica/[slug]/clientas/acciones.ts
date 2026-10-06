"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerContextoClinica, requerirAdmin } from "@/lib/sesion";
import { errorAccion, mensajeDeError, type EstadoAccion } from "@/lib/errores";
import { normalizarTelefono } from "@/lib/telefono";

const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "").trim();
const ruta = (slug: string, id?: string) => `/clinica/${slug}/clientas${id ? `/${id}` : ""}`;

function leerTelefono(d: FormData): { telefono: string | null; error?: string } {
  const escrito = texto(d, "telefono");
  if (!escrito) return { telefono: null };
  const telefono = normalizarTelefono(escrito);
  return telefono ? { telefono } : { telefono: null, error: "El teléfono no es válido. Ejemplo: 612 345 678 o +44 7700 900123." };
}

export async function crearClienta(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  let id: string;
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "Escribe el nombre." };
    const { telefono, error: errorTel } = leerTelefono(d);
    if (errorTel) return { error: errorTel };
    const consentimiento = d.get("consentimiento") === "on";
    const { data, error } = await supabase
      .from("clientas")
      .insert({
        clinica_id: clinica.id,
        nombre,
        telefono,
        email: texto(d, "email") || null,
        notas_asistente: texto(d, "notas_asistente") || null,
        origen: "panel",
        consentimiento_privacidad_at: consentimiento ? new Date().toISOString() : null,
        consentimiento_via: consentimiento ? "panel" : null,
      })
      .select("id")
      .single();
    if (error) return { error: mensajeDeError(error) };
    id = data.id;
  } catch (e) {
    return errorAccion(e);
  }
  redirect(ruta(slug, id));
}

export async function guardarClienta(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "Escribe el nombre." };
    const { telefono, error: errorTel } = leerTelefono(d);
    if (errorTel) return { error: errorTel };

    const cambios: Record<string, unknown> = {
      nombre,
      telefono,
      email: texto(d, "email") || null,
      notas_asistente: texto(d, "notas_asistente") || null,
    };
    if (d.get("registrar_consentimiento") === "on") {
      cambios.consentimiento_privacidad_at = new Date().toISOString();
      cambios.consentimiento_via = "panel";
    }
    const { error } = await supabase.from("clientas").update(cambios).eq("id", id).eq("clinica_id", clinica.id);
    if (error) return { error: mensajeDeError(error) };
    revalidatePath(ruta(slug, id));
    return { ok: true, mensaje: "Ficha guardada." };
  } catch (e) {
    return errorAccion(e);
  }
}

/** Notas clínicas: las pueden escribir la admin y la profesional que atiende a la clienta */
export async function guardarNotasClinicas(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica, usuario } = await obtenerContextoClinica(slug);
    const { error } = await supabase
      .from("notas_clinicas")
      .upsert({ clienta_id: id, clinica_id: clinica.id, texto: texto(d, "texto"), updated_by: usuario.id });
    if (error) return { error: mensajeDeError(error) };
    revalidatePath(ruta(slug, id));
    return { ok: true, mensaje: "Notas clínicas guardadas." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function fusionarClienta(slug: string, conservarId: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase } = await requerirAdmin(slug);
    const eliminarId = texto(d, "duplicada_id");
    if (!eliminarId) return { error: "Busca y elige la ficha duplicada." };
    const { error } = await supabase.rpc("fusionar_clientas", { p_conservar: conservarId, p_eliminar: eliminarId });
    if (error) return { error: mensajeDeError(error) };
    revalidatePath(ruta(slug), "layout");
    return { ok: true, mensaje: "Fichas fusionadas: las citas y datos de la duplicada están ahora en esta ficha." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function borrarDatosClienta(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase } = await requerirAdmin(slug);
    if (texto(d, "confirmacion").toUpperCase() !== "BORRAR") {
      return { error: "Escribe BORRAR para confirmar." };
    }
    const { error } = await supabase.rpc("anonimizar_clienta", { p_clienta_id: id });
    if (error) return { error: mensajeDeError(error) };
    revalidatePath(ruta(slug), "layout");
    return { ok: true, mensaje: "Datos personales borrados. Queda constancia de la fecha de la solicitud." };
  } catch (e) {
    return errorAccion(e);
  }
}
