"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { obtenerContextoClinica, requerirAdmin } from "@/lib/sesion";
import { ErrorUsuario, errorAccion, mensajeDeError, type EstadoAccion } from "@/lib/errores";
import { horaLocalAUtc } from "@/lib/fechas";
import { normalizarTelefono } from "@/lib/telefono";
import type { EstadoCita } from "@/lib/tipos";

const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "").trim();

export interface ClientaEncontrada {
  id: string;
  nombre: string;
  telefono: string | null;
}

/** Buscador de clientas por nombre o teléfono (para el formulario de cita) */
export async function buscarClientas(slug: string, consulta: string): Promise<ClientaEncontrada[]> {
  const { supabase, clinica } = await obtenerContextoClinica(slug);
  const q = consulta.trim();
  if (q.length < 2) return [];
  let peticion = supabase
    .from("clientas")
    .select("id, nombre, telefono")
    .eq("clinica_id", clinica.id)
    .is("anonimizada_at", null)
    .order("nombre")
    .limit(10);
  const telefono = normalizarTelefono(q);
  if (telefono) {
    peticion = peticion.eq("telefono", telefono);
  } else {
    // Quitamos los caracteres especiales del filtro de búsqueda
    const limpio = q.replace(/[%,()*\\]/g, " ");
    peticion = peticion.or(`nombre.ilike.%${limpio}%,telefono.ilike.%${limpio.replace(/\s/g, "")}%`);
  }
  const { data } = await peticion;
  return (data ?? []) as ClientaEncontrada[];
}

/** Crea una cita desde el panel (y la clienta, si es nueva) */
export async function crearCita(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  let citaId: string;
  try {
    const { supabase, clinica } = await requerirAdmin(slug);

    let clientaId = texto(d, "clienta_id");
    if (!clientaId) {
      const nombre = texto(d, "nueva_nombre");
      if (!nombre) return { error: "Elige una clienta o escribe el nombre de una nueva." };
      const telefonoEscrito = texto(d, "nueva_telefono");
      const telefono = normalizarTelefono(telefonoEscrito);
      if (telefonoEscrito && !telefono) return { error: "El teléfono de la clienta no es válido." };
      const consentimiento = d.get("nueva_consentimiento") === "on";
      const { data, error } = await supabase
        .from("clientas")
        .insert({
          clinica_id: clinica.id,
          nombre,
          telefono,
          email: texto(d, "nueva_email") || null,
          origen: "panel",
          consentimiento_privacidad_at: consentimiento ? new Date().toISOString() : null,
          consentimiento_via: consentimiento ? "panel" : null,
        })
        .select("id")
        .single();
      if (error) return { error: mensajeDeError(error) };
      clientaId = data.id;
    }

    const fecha = texto(d, "fecha");
    const hora = texto(d, "hora");
    const tratamientoId = texto(d, "tratamiento_id");
    const profesionalId = texto(d, "profesional_id");
    if (!fecha || !hora || !tratamientoId || !profesionalId) {
      return { error: "Completa tratamiento, profesional, día y hora." };
    }
    const forzar = d.get("forzar") === "on";
    const { data, error } = await supabase.rpc("reservar_cita", {
      p_clinica_id: clinica.id,
      p_clienta_id: clientaId,
      p_tratamiento_id: tratamientoId,
      p_inicio: horaLocalAUtc(fecha, hora, clinica.zona_horaria).toISOString(),
      p_profesional_id: profesionalId,
      p_origen: "panel",
      p_forzar: forzar,
      p_estado: texto(d, "estado") === "confirmada" ? "confirmada" : "pendiente",
      p_notas: texto(d, "notas") || null,
    });
    if (error) {
      if (error.hint === "HUECO_NO_DISPONIBLE") {
        return {
          error:
            "Esa hora no está libre o queda fuera del horario de la profesional. " +
            "Si quieres darla igualmente, marca «Permitir fuera de horario».",
        };
      }
      return { error: mensajeDeError(error) };
    }
    citaId = data as string;
  } catch (e) {
    return errorAccion(e);
  }
  revalidatePath(`/clinica/${slug}/agenda`);
  redirect(`/clinica/${slug}/agenda/cita/${citaId}`);
}

/** Cambia el estado de una cita (la profesional también puede, salvo cancelar) */
export async function cambiarEstadoCita(slug: string, citaId: string, estado: EstadoCita) {
  const { supabase, clinica, esAdmin } = await obtenerContextoClinica(slug);
  if (estado === "cancelada" && !esAdmin) throw new ErrorUsuario("Solo la clínica puede cancelar citas.");
  const cambios: Record<string, unknown> = { estado };
  if (estado === "cancelada") cambios.cancelada_por = "clinica";
  await supabase.from("citas").update(cambios).eq("id", citaId).eq("clinica_id", clinica.id);
  revalidatePath(`/clinica/${slug}/agenda`, "layout");
}

export async function guardarNotasCita(slug: string, citaId: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await obtenerContextoClinica(slug);
    const { error } = await supabase
      .from("citas")
      .update({ notas: texto(d, "notas") || null })
      .eq("id", citaId)
      .eq("clinica_id", clinica.id);
    if (error) return { error: mensajeDeError(error) };
    revalidatePath(`/clinica/${slug}/agenda/cita/${citaId}`);
    return { ok: true, mensaje: "Notas guardadas." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function moverCita(slug: string, citaId: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const fecha = texto(d, "fecha");
    const hora = texto(d, "hora");
    if (!fecha || !hora) return { error: "Elige el día y la hora." };
    const { error } = await supabase.rpc("mover_cita", {
      p_cita_id: citaId,
      p_inicio: horaLocalAUtc(fecha, hora, clinica.zona_horaria).toISOString(),
      p_profesional_id: texto(d, "profesional_id") || null,
    });
    if (error) return { error: mensajeDeError(error) };
    revalidatePath(`/clinica/${slug}/agenda`, "layout");
    return { ok: true, mensaje: "Cita movida." };
  } catch (e) {
    return errorAccion(e);
  }
}
