import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { inject } from "vitest";
import { horaLocalAUtc, sumarDias } from "@/lib/fechas";

/**
 * Utilidades para preparar datos de prueba en la base de datos local.
 * Cada archivo de pruebas crea sus propias clínicas con nombres únicos,
 * así no dependen unas de otras ni de los datos de la demo.
 */

const opciones = { auth: { persistSession: false, autoRefreshToken: false } };

export const servicio = () => createClient(inject("supabaseUrl"), inject("claveSecreta"), opciones);
export const anonimo = () => createClient(inject("supabaseUrl"), inject("clavePublica"), opciones);

export const ZONA = "Europe/Madrid";
const CONTRASENA = "prueba-segura-123";
const sufijo = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Fecha dentro de N días (formato AAAA-MM-DD) */
export const dentroDe = (dias: number) => sumarDias(new Date().toISOString().slice(0, 10), dias);
/** Instante ISO de un día y hora de Madrid */
export const instante = (fecha: string, hora: string) => horaLocalAUtc(fecha, hora, ZONA).toISOString();

export function sinError<T>(r: { data: T; error: unknown }): NonNullable<T> {
  if (r.error) throw new Error(`Error inesperado: ${JSON.stringify(r.error)}`);
  return r.data as NonNullable<T>;
}

/** Crea un usuario y devuelve un cliente con su sesión iniciada */
export async function crearUsuario(): Promise<{ id: string; email: string; cliente: SupabaseClient }> {
  const email = `prueba-${sufijo()}@pruebas.local`;
  const svc = servicio();
  const { data, error } = await svc.auth.admin.createUser({ email, password: CONTRASENA, email_confirm: true });
  if (error) throw error;
  const cliente = anonimo();
  const r = await cliente.auth.signInWithPassword({ email, password: CONTRASENA });
  if (r.error) throw r.error;
  return { id: data.user.id, email, cliente };
}

export interface Escenario {
  clinicaId: string;
  p1: string;
  p2: string;
  cabina: string;
  /** 60 min, necesita la cabina, lo hacen p1 y p2 */
  tConCabina: string;
  /** 30 min, sin cabina, solo p1 */
  tSoloP1: string;
  /** 30 min, sin cabina, lo hacen p1 y p2 */
  tAmbas: string;
  clienta: string;
  clienta2: string;
}

/**
 * Clínica de pruebas abierta todos los días de 8:00 a 22:00, sin antelación mínima,
 * con dos profesionales, una cabina y tres tratamientos.
 */
export async function crearEscenario(nombre = "Clínica de prueba"): Promise<Escenario> {
  const svc = servicio();
  const s = sufijo();
  const clinica = sinError(
    await svc
      .from("clinicas")
      .insert({ nombre: `${nombre} ${s}`, slug: `prueba-${s}`, antelacion_minima_reserva_min: 0, intervalo_huecos_min: 15 })
      .select("id")
      .single(),
  );
  const c = clinica.id as string;
  const dias = [1, 2, 3, 4, 5, 6, 7];
  sinError(await svc.from("horarios_clinica").insert(dias.map((d) => ({ clinica_id: c, dia_semana: d, hora_inicio: "08:00", hora_fin: "22:00" }))));

  const profs = sinError(
    await svc
      .from("profesionales")
      .insert([
        { clinica_id: c, nombre: "Uno" },
        { clinica_id: c, nombre: "Dos" },
      ])
      .select("id, nombre"),
  ) as { id: string; nombre: string }[];
  const p1 = profs.find((p) => p.nombre === "Uno")!.id;
  const p2 = profs.find((p) => p.nombre === "Dos")!.id;
  sinError(
    await svc.from("horarios_profesional").insert(
      dias.flatMap((d) => [
        { clinica_id: c, profesional_id: p1, dia_semana: d, hora_inicio: "08:00", hora_fin: "22:00" },
        { clinica_id: c, profesional_id: p2, dia_semana: d, hora_inicio: "08:00", hora_fin: "22:00" },
      ]),
    ),
  );

  const cabina = sinError(await svc.from("cabinas").insert({ clinica_id: c, nombre: "Cabina única" }).select("id").single()).id as string;

  const trats = sinError(
    await svc
      .from("tratamientos")
      .insert([
        { clinica_id: c, nombre: "Con cabina", duracion_min: 60 },
        { clinica_id: c, nombre: "Solo uno", duracion_min: 30 },
        { clinica_id: c, nombre: "Ambas", duracion_min: 30 },
      ])
      .select("id, nombre"),
  ) as { id: string; nombre: string }[];
  const t = (n: string) => trats.find((x) => x.nombre === n)!.id;
  sinError(
    await svc.from("tratamiento_profesionales").insert([
      { clinica_id: c, tratamiento_id: t("Con cabina"), profesional_id: p1 },
      { clinica_id: c, tratamiento_id: t("Con cabina"), profesional_id: p2 },
      { clinica_id: c, tratamiento_id: t("Solo uno"), profesional_id: p1 },
      { clinica_id: c, tratamiento_id: t("Ambas"), profesional_id: p1 },
      { clinica_id: c, tratamiento_id: t("Ambas"), profesional_id: p2 },
    ]),
  );
  sinError(await svc.from("tratamiento_cabinas").insert({ clinica_id: c, tratamiento_id: t("Con cabina"), cabina_id: cabina }));

  const clientas = sinError(
    await svc
      .from("clientas")
      .insert([
        { clinica_id: c, nombre: "Clienta Prueba", telefono: `+346${String(Math.floor(Math.random() * 1e8)).padStart(8, "0")}` },
        { clinica_id: c, nombre: "Otra Clienta" },
      ])
      .select("id, nombre"),
  ) as { id: string; nombre: string }[];

  return {
    clinicaId: c,
    p1,
    p2,
    cabina,
    tConCabina: t("Con cabina"),
    tSoloP1: t("Solo uno"),
    tAmbas: t("Ambas"),
    clienta: clientas.find((x) => x.nombre === "Clienta Prueba")!.id,
    clienta2: clientas.find((x) => x.nombre === "Otra Clienta")!.id,
  };
}

/** Reserva como lo haría la web o el asistente (servidor, sin forzar) */
export function reservar(
  e: Escenario,
  opciones: { tratamiento: string; inicio: string; profesional?: string | null; clienta?: string },
) {
  return servicio().rpc("reservar_cita", {
    p_clinica_id: e.clinicaId,
    p_clienta_id: opciones.clienta ?? e.clienta,
    p_tratamiento_id: opciones.tratamiento,
    p_inicio: opciones.inicio,
    p_profesional_id: opciones.profesional === undefined ? null : opciones.profesional,
    p_origen: "web",
  });
}

/** Da acceso a un usuario a una clínica */
export async function hacerMiembro(userId: string, clinicaId: string, rol: "admin" | "profesional", profesionalId?: string) {
  sinError(
    await servicio()
      .from("miembros")
      .insert({ user_id: userId, clinica_id: clinicaId, rol, profesional_id: profesionalId ?? null }),
  );
}
