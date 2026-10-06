import { TZDate } from "@date-fns/tz";

/**
 * Las citas se guardan en hora universal y se muestran en la hora de la clínica
 * (Europe/Madrid o Atlantic/Canary). Estas funciones hacen la conversión.
 */

/** "2026-10-07" + "10:30" en la hora de la clínica -> instante exacto (Date) */
export function horaLocalAUtc(fecha: string, hora: string, zona: string): Date {
  const [a, m, d] = fecha.split("-").map(Number);
  const [h, min] = hora.split(":").map(Number);
  if ([a, m, d, h, min].some((n) => Number.isNaN(n))) {
    throw new Error("Fecha u hora no válidas");
  }
  return new Date(new TZDate(a, m - 1, d, h, min, zona).getTime());
}

function partes(instante: Date | string, zona: string) {
  const fecha = typeof instante === "string" ? new Date(instante) : instante;
  const p = new Intl.DateTimeFormat("en-CA", {
    timeZone: zona,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(fecha);
  const v = (tipo: string) => p.find((x) => x.type === tipo)?.value ?? "";
  return { fecha: `${v("year")}-${v("month")}-${v("day")}`, hora: `${v("hour")}:${v("minute")}` };
}

/** Fecha "AAAA-MM-DD" en la hora de la clínica */
export function fechaLocal(instante: Date | string, zona: string): string {
  return partes(instante, zona).fecha;
}

/** Hora "HH:MM" en la hora de la clínica */
export function horaLocal(instante: Date | string, zona: string): string {
  return partes(instante, zona).hora;
}

/** Minutos desde medianoche en la hora de la clínica */
export function minutosDelDia(instante: Date | string, zona: string): number {
  const [h, m] = horaLocal(instante, zona).split(":").map(Number);
  return h * 60 + m;
}

/** Hoy en la clínica, "AAAA-MM-DD" */
export function hoyEn(zona: string): string {
  return fechaLocal(new Date(), zona);
}

/** Suma días a una fecha "AAAA-MM-DD" (sin problemas de horario de verano) */
export function sumarDias(fecha: string, dias: number): string {
  const [a, m, d] = fecha.split("-").map(Number);
  const f = new Date(Date.UTC(a, m - 1, d + dias));
  return f.toISOString().slice(0, 10);
}

/** Día de la semana ISO (1 = lunes ... 7 = domingo) de una fecha "AAAA-MM-DD" */
export function diaSemana(fecha: string): number {
  const [a, m, d] = fecha.split("-").map(Number);
  const dia = new Date(Date.UTC(a, m - 1, d)).getUTCDay();
  return dia === 0 ? 7 : dia;
}

/** Lunes de la semana de esa fecha */
export function lunesDe(fecha: string): string {
  return sumarDias(fecha, 1 - diaSemana(fecha));
}

export const NOMBRES_DIAS = ["Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado", "Domingo"];

/** "martes, 7 de octubre de 2026" */
export function fechaLarga(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** "mar 7 oct" */
export function fechaCorta(fecha: string): string {
  const [a, m, d] = fecha.split("-").map(Number);
  return new Intl.DateTimeFormat("es-ES", {
    weekday: "short",
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(new Date(Date.UTC(a, m - 1, d)));
}

/** "7/10/2026 10:30" en la hora de la clínica */
export function fechaHora(instante: Date | string, zona: string): string {
  const fecha = typeof instante === "string" ? new Date(instante) : instante;
  return new Intl.DateTimeFormat("es-ES", {
    timeZone: zona,
    day: "numeric",
    month: "numeric",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(fecha);
}

/** "HH:MM" -> minutos */
export function aMinutos(hora: string): number {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

/** minutos -> "HH:MM" */
export function deMinutos(min: number): string {
  return `${String(Math.floor(min / 60)).padStart(2, "0")}:${String(min % 60).padStart(2, "0")}`;
}
