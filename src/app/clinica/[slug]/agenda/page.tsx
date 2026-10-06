import Link from "next/link";
import { obtenerContextoClinica } from "@/lib/sesion";
import {
  aMinutos,
  diaSemana,
  fechaCorta,
  fechaLarga,
  fechaLocal,
  horaLocalAUtc,
  hoyEn,
  lunesDe,
  minutosDelDia,
  sumarDias,
} from "@/lib/fechas";
import type { Ausencia, Cabina, Cierre, EstadoCita, Profesional, Tramo } from "@/lib/tipos";
import { RejillaAgenda, type CitaRejilla, type ColumnaRejilla } from "./rejilla";

export const metadata = { title: "Agenda" };

interface CitaAgenda {
  id: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  profesional_id: string;
  cabina_id: string | null;
  clientas: { nombre: string } | null;
  tratamientos: { nombre: string } | null;
}

type TramoProf = Tramo & { profesional_id: string };

export default async function PaginaAgenda({ params, searchParams }: PageProps<"/clinica/[slug]/agenda">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, clinica, esAdmin, profesionalId } = await obtenerContextoClinica(slug);
  const tz = clinica.zona_horaria;
  const leer = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  // --- Parámetros de la vista ------------------------------------------------
  const fecha = /^\d{4}-\d{2}-\d{2}$/.test(leer("fecha")) ? leer("fecha") : hoyEn(tz);
  const vista = leer("vista") === "semana" ? "semana" : "dia";
  const por = esAdmin && leer("por") === "cabina" ? "cabina" : "profesional";
  const verCanceladas = leer("canceladas") === "1";
  const inicioRango = vista === "semana" ? lunesDe(fecha) : fecha;
  const dias = vista === "semana" ? 7 : 1;
  const fechas = Array.from({ length: dias }, (_, i) => sumarDias(inicioRango, i));

  // --- Datos -------------------------------------------------------------------
  const desdeUtc = horaLocalAUtc(inicioRango, "00:00", tz).toISOString();
  const hastaUtc = horaLocalAUtc(sumarDias(inicioRango, dias), "00:00", tz).toISOString();

  let consultaCitas = supabase
    .from("citas")
    .select("id, inicio, fin, estado, profesional_id, cabina_id, clientas(nombre), tratamientos(nombre)")
    .eq("clinica_id", clinica.id)
    .lt("inicio", hastaUtc)
    .gt("fin", desdeUtc)
    .order("inicio");
  if (!verCanceladas) consultaCitas = consultaCitas.neq("estado", "cancelada");

  const [rProfs, rCabinas, rHorClinica, rHorProf, rCierres, rAusencias, rCitas] = await Promise.all([
    supabase.from("profesionales").select("*").eq("clinica_id", clinica.id).eq("activa", true).order("orden").order("nombre"),
    supabase.from("cabinas").select("*").eq("clinica_id", clinica.id).eq("activa", true).order("nombre"),
    supabase.from("horarios_clinica").select("*").eq("clinica_id", clinica.id),
    supabase.from("horarios_profesional").select("*").eq("clinica_id", clinica.id),
    supabase
      .from("cierres_clinica")
      .select("*")
      .eq("clinica_id", clinica.id)
      .lte("fecha_inicio", fechas[fechas.length - 1])
      .gte("fecha_fin", fechas[0]),
    supabase.from("ausencias_profesional").select("*").eq("clinica_id", clinica.id).lt("inicio", hastaUtc).gt("fin", desdeUtc),
    consultaCitas,
  ]);

  let profesionales = (rProfs.data ?? []) as Profesional[];
  if (!esAdmin) profesionales = profesionales.filter((p) => p.id === profesionalId);
  const cabinas = (rCabinas.data ?? []) as Cabina[];
  const horClinica = (rHorClinica.data ?? []) as Tramo[];
  const horProf = (rHorProf.data ?? []) as TramoProf[];
  const cierres = (rCierres.data ?? []) as Cierre[];
  const ausencias = (rAusencias.data ?? []) as Ausencia[];
  const citas = (rCitas.data ?? []) as unknown as CitaAgenda[];
  const colorDe = new Map(profesionales.map((p) => [p.id, p.color]));
  const nombreProf = new Map(((rProfs.data ?? []) as Profesional[]).map((p) => [p.id, p.nombre]));

  // Recurso de la vista semanal
  const recursos = por === "profesional" ? profesionales : cabinas;
  const recursoId = recursos.some((r) => r.id === leer("recurso")) ? leer("recurso") : recursos[0]?.id;

  // --- Utilidades ----------------------------------------------------------------
  const url = (cambios: Record<string, string | null>) => {
    const p = new URLSearchParams();
    const actual: Record<string, string> = { fecha, vista, por, recurso: recursoId ?? "", canceladas: verCanceladas ? "1" : "" };
    for (const [k, v] of Object.entries({ ...actual, ...cambios })) if (v) p.set(k, v);
    return `/clinica/${slug}/agenda?${p.toString()}`;
  };
  const cerradoEl = (f: string) => cierres.find((c) => c.fecha_inicio <= f && f <= c.fecha_fin);
  const tramosDe = (tramos: Tramo[], f: string) =>
    tramos.filter((t) => t.dia_semana === diaSemana(f)).map((t) => ({ desde: aMinutos(t.hora_inicio), hasta: aMinutos(t.hora_fin) }));
  const citasDelDia = (f: string, filtro: (c: CitaAgenda) => boolean) =>
    citas.filter((c) => fechaLocal(c.inicio, tz) === f && filtro(c)).map((c) => aRejilla(c));
  const aRejilla = (c: CitaAgenda): CitaRejilla => ({
    id: c.id,
    inicio: c.inicio,
    fin: c.fin,
    estado: c.estado,
    clienta: c.clientas?.nombre ?? "—",
    tratamiento: `${c.tratamientos?.nombre ?? ""}${por === "cabina" ? ` · ${nombreProf.get(c.profesional_id) ?? ""}` : ""}`,
    color: colorDe.get(c.profesional_id) ?? "#a8a29e",
    detalle: `/clinica/${slug}/agenda/cita/${c.id}`,
  });
  const ausenciasDe = (profId: string, f: string) =>
    ausencias
      .filter((a) => a.profesional_id === profId && fechaLocal(a.inicio, tz) <= f && f <= fechaLocal(a.fin, tz))
      .map((a) => ({
        desde: fechaLocal(a.inicio, tz) === f ? minutosDelDia(a.inicio, tz) : 0,
        hasta: fechaLocal(a.fin, tz) === f ? minutosDelDia(a.fin, tz) : 24 * 60,
        texto: a.motivo ?? "Ausente",
      }));

  const columnaProfesional = (p: Profesional, f: string, titulo: string, subtitulo?: string): ColumnaRejilla => {
    const cierre = cerradoEl(f);
    const tramosClinica = tramosDe(horClinica, f);
    // Disponible = cuando trabaja ella y la clínica está abierta
    const disponible = cierre
      ? []
      : tramosDe(horProf.filter((t) => t.profesional_id === p.id), f).flatMap((tp) =>
          tramosClinica
            .map((tc) => ({ desde: Math.max(tp.desde, tc.desde), hasta: Math.min(tp.hasta, tc.hasta) }))
            .filter((t) => t.hasta > t.desde),
        );
    return {
      clave: `${p.id}-${f}`,
      titulo,
      subtitulo,
      color: vista === "dia" ? p.color : undefined,
      disponible,
      bloqueos: ausenciasDe(p.id, f),
      citas: citasDelDia(f, (c) => c.profesional_id === p.id),
      enlaceNueva: esAdmin ? (hora) => `/clinica/${slug}/agenda/nueva?fecha=${f}&hora=${hora}&profesional=${p.id}` : undefined,
      aviso: cierre ? `Cerrado${cierre.motivo ? `: ${cierre.motivo}` : ""}` : undefined,
    };
  };
  const columnaCabina = (c: Cabina, f: string, titulo: string, subtitulo?: string): ColumnaRejilla => {
    const cierre = cerradoEl(f);
    return {
      clave: `${c.id}-${f}`,
      titulo,
      subtitulo,
      disponible: cierre ? [] : tramosDe(horClinica, f),
      bloqueos: [],
      citas: citasDelDia(f, (x) => x.cabina_id === c.id),
      enlaceNueva: esAdmin ? (hora) => `/clinica/${slug}/agenda/nueva?fecha=${f}&hora=${hora}` : undefined,
      aviso: cierre ? "Cerrado" : undefined,
    };
  };

  let columnas: ColumnaRejilla[] = [];
  if (vista === "dia") {
    columnas =
      por === "profesional"
        ? profesionales.map((p) => columnaProfesional(p, fecha, p.nombre))
        : cabinas.map((c) => columnaCabina(c, fecha, c.nombre));
  } else if (recursoId) {
    columnas = fechas.map((f) => {
      const titulo = fechaCorta(f);
      if (por === "profesional") return columnaProfesional(profesionales.find((p) => p.id === recursoId)!, f, titulo);
      return columnaCabina(cabinas.find((c) => c.id === recursoId)!, f, titulo);
    });
  }

  // Horas visibles: horario de la clínica, ampliado si hay citas fuera
  const minutosAbiertos = horClinica.flatMap((t) => [aMinutos(t.hora_inicio), aMinutos(t.hora_fin)]);
  const minutosCitas = citas.flatMap((c) => [minutosDelDia(c.inicio, tz), minutosDelDia(c.fin, tz) || 24 * 60]);
  const todos = [...minutosAbiertos, ...minutosCitas];
  const desde = todos.length ? Math.floor(Math.min(...todos) / 60) * 60 : 9 * 60;
  const hasta = todos.length ? Math.ceil(Math.max(...todos) / 60) * 60 : 20 * 60;

  const paso = vista === "semana" ? 7 : 1;
  const tituloFecha =
    vista === "semana" ? `Semana del ${fechaCorta(fechas[0])} al ${fechaCorta(fechas[6])}` : fechaLarga(fecha);
  const chip = (activo: boolean) =>
    `rounded-lg px-3 py-1.5 text-sm ${activo ? "bg-stone-900 text-white" : "bg-white text-stone-700 border border-stone-300 hover:bg-stone-100"}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <h1 className="mr-auto text-xl font-semibold first-letter:uppercase">{tituloFecha}</h1>
        {esAdmin && (
          <Link href={`/clinica/${slug}/agenda/nueva?fecha=${fecha}`} className="boton">
            Nueva cita
          </Link>
        )}
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <Link href={url({ fecha: sumarDias(fecha, -paso) })} className={chip(false)} aria-label="Anterior">
          ←
        </Link>
        <Link href={url({ fecha: hoyEn(tz) })} className={chip(false)}>
          Hoy
        </Link>
        <Link href={url({ fecha: sumarDias(fecha, paso) })} className={chip(false)} aria-label="Siguiente">
          →
        </Link>
        <form action={`/clinica/${slug}/agenda`} className="flex items-center gap-2">
          <input type="hidden" name="vista" value={vista} />
          <input type="hidden" name="por" value={por} />
          {recursoId && <input type="hidden" name="recurso" value={recursoId} />}
          <input type="date" name="fecha" defaultValue={fecha} className="campo w-40" aria-label="Ir a la fecha" />
          <button className={chip(false)}>Ir</button>
        </form>
        <span className="mx-2 h-6 w-px bg-stone-300" />
        <Link href={url({ vista: "dia" })} className={chip(vista === "dia")}>
          Día
        </Link>
        <Link href={url({ vista: "semana" })} className={chip(vista === "semana")}>
          Semana
        </Link>
        {esAdmin && (
          <>
            <span className="mx-2 h-6 w-px bg-stone-300" />
            <Link href={url({ por: "profesional", recurso: null })} className={chip(por === "profesional")}>
              Por profesional
            </Link>
            <Link href={url({ por: "cabina", recurso: null })} className={chip(por === "cabina")}>
              Por cabina
            </Link>
          </>
        )}
        <Link href={url({ canceladas: verCanceladas ? null : "1" })} className="enlace ml-auto text-sm">
          {verCanceladas ? "Ocultar canceladas" : "Ver canceladas"}
        </Link>
      </div>

      {vista === "semana" && recursos.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {recursos.map((r) => (
            <Link key={r.id} href={url({ recurso: r.id })} className={chip(r.id === recursoId)}>
              {r.nombre}
            </Link>
          ))}
        </div>
      )}

      {columnas.length === 0 ? (
        <p className="rounded-lg border border-dashed border-stone-300 p-8 text-center text-sm text-stone-500">
          {por === "cabina" ? "No hay cabinas activas." : "No hay profesionales activas."}{" "}
          {esAdmin && (
            <Link href={`/clinica/${slug}/configuracion`} className="enlace">
              Ir a configuración
            </Link>
          )}
        </p>
      ) : (
        <RejillaAgenda columnas={columnas} desde={desde} hasta={hasta} zona={tz} />
      )}
      <p className="text-xs text-stone-500">
        Las zonas grises están fuera de horario. {esAdmin && "Pulsa en un hueco blanco para dar una cita."}
      </p>
    </div>
  );
}
