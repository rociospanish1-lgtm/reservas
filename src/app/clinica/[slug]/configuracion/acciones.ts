"use server";

import { revalidatePath } from "next/cache";
import { requerirAdmin } from "@/lib/sesion";
import { ErrorUsuario, errorAccion, mensajeDeError, type EstadoAccion } from "@/lib/errores";
import { leerHorarioSemanal } from "@/lib/horarios";
import { horaLocalAUtc } from "@/lib/fechas";
import { invitarAClinica } from "@/lib/invitaciones";
import type { PreguntaFrecuente, Rol } from "@/lib/tipos";

// ---------------------------------------------------------------------------
// Utilidades para leer formularios
// ---------------------------------------------------------------------------
const texto = (d: FormData, campo: string) => String(d.get(campo) ?? "").trim();
const textoONulo = (d: FormData, campo: string) => texto(d, campo) || null;
function entero(d: FormData, campo: string, nombre: string, { min = 0, max = 100000 } = {}): number {
  const n = Number(texto(d, campo));
  if (!Number.isInteger(n) || n < min || n > max) throw new ErrorUsuario(`${nombre}: escribe un número entre ${min} y ${max}.`);
  return n;
}
function enteroONulo(d: FormData, campo: string, nombre: string): number | null {
  return texto(d, campo) ? entero(d, campo, nombre, { min: 1, max: 100 }) : null;
}
function comprobar(error: { code?: string; message?: string } | null) {
  if (error) throw new ErrorUsuario(mensajeDeError(error));
}
const ruta = (slug: string, resto = "") => `/clinica/${slug}/configuracion${resto}`;

// ---------------------------------------------------------------------------
// Datos de la clínica
// ---------------------------------------------------------------------------
export async function guardarDatosClinica(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "El nombre no puede estar vacío." };
    const { error } = await supabase
      .from("clinicas")
      .update({
        nombre,
        direccion: textoONulo(d, "direccion"),
        telefono: textoONulo(d, "telefono"),
        email: textoONulo(d, "email"),
        zona_horaria: texto(d, "zona_horaria"),
        url_politica_privacidad: textoONulo(d, "url_politica_privacidad"),
        intervalo_huecos_min: entero(d, "intervalo_huecos_min", "Intervalo entre huecos", { min: 5, max: 60 }),
        antelacion_minima_reserva_min: entero(d, "antelacion_horas", "Antelación mínima", { min: 0, max: 720 }) * 60,
        horas_minimas_cancelacion: entero(d, "horas_minimas_cancelacion", "Horas para cancelar", { min: 0, max: 720 }),
        tono_asistente: texto(d, "tono_asistente") || "Cercano y profesional.",
        instrucciones_extra_asistente: textoONulo(d, "instrucciones_extra_asistente"),
      })
      .eq("id", clinica.id);
    comprobar(error);
    revalidatePath(`/clinica/${slug}`, "layout");
    return { ok: true, mensaje: "Datos guardados." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function guardarHorarioClinica(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const tramos = leerHorarioSemanal(d);
    comprobar((await supabase.from("horarios_clinica").delete().eq("clinica_id", clinica.id)).error);
    if (tramos.length) {
      comprobar(
        (await supabase.from("horarios_clinica").insert(tramos.map((t) => ({ ...t, clinica_id: clinica.id })))).error,
      );
    }
    revalidatePath(ruta(slug));
    return { ok: true, mensaje: "Horario guardado." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function anadirCierre(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const inicio = texto(d, "fecha_inicio");
    const fin = texto(d, "fecha_fin") || inicio;
    if (!inicio) return { error: "Elige la fecha." };
    if (fin < inicio) return { error: "La fecha final no puede ser anterior a la inicial." };
    comprobar(
      (
        await supabase
          .from("cierres_clinica")
          .insert({ clinica_id: clinica.id, fecha_inicio: inicio, fecha_fin: fin, motivo: textoONulo(d, "motivo") })
      ).error,
    );
    revalidatePath(ruta(slug));
    return { ok: true, mensaje: "Cierre añadido." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function borrarCierre(slug: string, id: string) {
  const { supabase, clinica } = await requerirAdmin(slug);
  await supabase.from("cierres_clinica").delete().eq("id", id).eq("clinica_id", clinica.id);
  revalidatePath(ruta(slug));
}

// ---------------------------------------------------------------------------
// Profesionales
// ---------------------------------------------------------------------------
export async function crearProfesional(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "Escribe el nombre." };
    comprobar(
      (await supabase.from("profesionales").insert({ clinica_id: clinica.id, nombre, color: texto(d, "color") || "#c084fc" }))
        .error,
    );
    revalidatePath(ruta(slug, "/profesionales"));
    return { ok: true, mensaje: `${nombre} añadida. Entra en su ficha para ponerle horario y tratamientos.` };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function guardarProfesional(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "Escribe el nombre." };
    comprobar(
      (
        await supabase
          .from("profesionales")
          .update({ nombre, color: texto(d, "color"), activa: d.get("activa") === "on" })
          .eq("id", id)
          .eq("clinica_id", clinica.id)
      ).error,
    );
    // Tratamientos que hace
    const tratamientos = d.getAll("tratamientos").map(String);
    comprobar((await supabase.from("tratamiento_profesionales").delete().eq("profesional_id", id)).error);
    if (tratamientos.length) {
      comprobar(
        (
          await supabase
            .from("tratamiento_profesionales")
            .insert(tratamientos.map((t) => ({ clinica_id: clinica.id, tratamiento_id: t, profesional_id: id })))
        ).error,
      );
    }
    revalidatePath(ruta(slug, "/profesionales"), "layout");
    return { ok: true, mensaje: "Guardado." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function guardarHorarioProfesional(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const tramos = leerHorarioSemanal(d);
    comprobar((await supabase.from("horarios_profesional").delete().eq("profesional_id", id).eq("clinica_id", clinica.id)).error);
    if (tramos.length) {
      comprobar(
        (
          await supabase
            .from("horarios_profesional")
            .insert(tramos.map((t) => ({ ...t, clinica_id: clinica.id, profesional_id: id })))
        ).error,
      );
    }
    revalidatePath(ruta(slug, `/profesionales/${id}`));
    return { ok: true, mensaje: "Horario guardado." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function anadirAusencia(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const desde = texto(d, "desde");
    const hasta = texto(d, "hasta") || desde;
    const horaDesde = texto(d, "hora_desde") || "00:00";
    const horaHasta = texto(d, "hora_hasta");
    if (!desde) return { error: "Elige la fecha." };
    const inicio = horaLocalAUtc(desde, horaDesde, clinica.zona_horaria);
    // Sin hora final = hasta el final de ese día
    const fin = horaHasta
      ? horaLocalAUtc(hasta, horaHasta, clinica.zona_horaria)
      : horaLocalAUtc(hasta, "23:59", clinica.zona_horaria);
    if (fin <= inicio) return { error: "El final tiene que ser posterior al inicio." };
    comprobar(
      (
        await supabase.from("ausencias_profesional").insert({
          clinica_id: clinica.id,
          profesional_id: id,
          inicio: inicio.toISOString(),
          fin: fin.toISOString(),
          motivo: textoONulo(d, "motivo"),
        })
      ).error,
    );
    revalidatePath(ruta(slug, `/profesionales/${id}`));
    return { ok: true, mensaje: "Ausencia añadida. Esas horas ya no se ofrecen para reservar." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function borrarAusencia(slug: string, profesionalId: string, id: string) {
  const { supabase, clinica } = await requerirAdmin(slug);
  await supabase.from("ausencias_profesional").delete().eq("id", id).eq("clinica_id", clinica.id);
  revalidatePath(ruta(slug, `/profesionales/${profesionalId}`));
}

// ---------------------------------------------------------------------------
// Cabinas
// ---------------------------------------------------------------------------
export async function crearCabina(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "Escribe el nombre de la cabina." };
    comprobar((await supabase.from("cabinas").insert({ clinica_id: clinica.id, nombre })).error);
    revalidatePath(ruta(slug, "/cabinas"));
    return { ok: true, mensaje: "Cabina añadida." };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function guardarCabina(slug: string, id: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const nombre = texto(d, "nombre");
    if (!nombre) return { error: "Escribe el nombre de la cabina." };
    comprobar(
      (
        await supabase
          .from("cabinas")
          .update({ nombre, activa: d.get("activa") === "on" })
          .eq("id", id)
          .eq("clinica_id", clinica.id)
      ).error,
    );
    revalidatePath(ruta(slug, "/cabinas"));
    return { ok: true, mensaje: "Guardado." };
  } catch (e) {
    return errorAccion(e);
  }
}

// ---------------------------------------------------------------------------
// Tratamientos
// ---------------------------------------------------------------------------
function leerTratamiento(d: FormData) {
  const nombre = texto(d, "nombre");
  if (!nombre) throw new ErrorUsuario("Escribe el nombre del tratamiento.");
  const precioTexto = texto(d, "precio").replace(",", ".");
  const precio = precioTexto ? Number(precioTexto) : null;
  if (precio !== null && (Number.isNaN(precio) || precio < 0)) throw new ErrorUsuario("El precio no es válido.");

  const preguntas = d.getAll("faq_pregunta").map((v) => String(v).trim());
  const respuestas = d.getAll("faq_respuesta").map((v) => String(v).trim());
  const faqs: PreguntaFrecuente[] = [];
  preguntas.forEach((pregunta, i) => {
    const respuesta = respuestas[i] ?? "";
    if (!pregunta && !respuesta) return;
    if (!pregunta || !respuesta) throw new ErrorUsuario("Cada pregunta frecuente necesita su respuesta.");
    faqs.push({ pregunta, respuesta });
  });

  return {
    nombre,
    descripcion: textoONulo(d, "descripcion"),
    duracion_min: entero(d, "duracion_min", "Duración", { min: 5, max: 480 }),
    precio,
    precio_desde: d.get("precio_desde") === "on",
    preparacion: textoONulo(d, "preparacion"),
    cuidados_posteriores: textoONulo(d, "cuidados_posteriores"),
    sesiones_recomendadas: enteroONulo(d, "sesiones_recomendadas", "Sesiones recomendadas"),
    contraindicaciones: textoONulo(d, "contraindicaciones"),
    preguntas_frecuentes: faqs,
    activo: d.get("activo") === "on",
    reservable_online: d.get("reservable_online") === "on",
  };
}

export async function guardarTratamiento(
  slug: string,
  id: string | null,
  _: EstadoAccion,
  d: FormData,
): Promise<EstadoAccion> {
  try {
    const { supabase, clinica } = await requerirAdmin(slug);
    const valores = leerTratamiento(d);
    let tratamientoId = id;
    if (id) {
      comprobar((await supabase.from("tratamientos").update(valores).eq("id", id).eq("clinica_id", clinica.id)).error);
    } else {
      const { data, error } = await supabase
        .from("tratamientos")
        .insert({ ...valores, clinica_id: clinica.id })
        .select("id")
        .single();
      comprobar(error);
      tratamientoId = data!.id;
    }

    const profesionales = d.getAll("profesionales").map(String);
    const cabinas = d.getAll("cabinas").map(String);
    comprobar((await supabase.from("tratamiento_profesionales").delete().eq("tratamiento_id", tratamientoId)).error);
    comprobar((await supabase.from("tratamiento_cabinas").delete().eq("tratamiento_id", tratamientoId)).error);
    if (profesionales.length) {
      comprobar(
        (
          await supabase
            .from("tratamiento_profesionales")
            .insert(profesionales.map((p) => ({ clinica_id: clinica.id, tratamiento_id: tratamientoId, profesional_id: p })))
        ).error,
      );
    }
    if (cabinas.length) {
      comprobar(
        (
          await supabase
            .from("tratamiento_cabinas")
            .insert(cabinas.map((c) => ({ clinica_id: clinica.id, tratamiento_id: tratamientoId, cabina_id: c })))
        ).error,
      );
    }
    revalidatePath(ruta(slug, "/tratamientos"), "layout");
    return { ok: true, mensaje: id ? "Tratamiento guardado." : "Tratamiento creado." };
  } catch (e) {
    return errorAccion(e);
  }
}

// ---------------------------------------------------------------------------
// Equipo y accesos
// ---------------------------------------------------------------------------
export async function invitarMiembro(slug: string, _: EstadoAccion, d: FormData): Promise<EstadoAccion> {
  try {
    const { clinica } = await requerirAdmin(slug);
    const rol = texto(d, "rol") as Rol;
    if (rol !== "admin" && rol !== "profesional") return { error: "Elige el tipo de acceso." };
    const r = await invitarAClinica({
      clinicaId: clinica.id,
      email: texto(d, "email"),
      rol,
      profesionalId: textoONulo(d, "profesional_id"),
    });
    revalidatePath(ruta(slug, "/equipo"));
    return {
      ok: true,
      mensaje: r === "invitada" ? "Invitación enviada por email." : "Esa persona ya tenía cuenta: se le ha dado acceso.",
    };
  } catch (e) {
    return errorAccion(e);
  }
}

export async function quitarMiembro(slug: string, miembroId: string) {
  const { supabase, clinica, usuario } = await requerirAdmin(slug);
  // Nadie puede quitarse el acceso a sí misma (para no quedarse fuera por error)
  await supabase.from("miembros").delete().eq("id", miembroId).eq("clinica_id", clinica.id).neq("user_id", usuario.id);
  revalidatePath(ruta(slug, "/equipo"));
}
