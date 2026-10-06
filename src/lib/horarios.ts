import { ErrorUsuario } from "@/lib/errores";
import { NOMBRES_DIAS, aMinutos } from "@/lib/fechas";
import type { Tramo } from "@/lib/tipos";

export interface TramoNuevo {
  dia_semana: number;
  hora_inicio: string;
  hora_fin: string;
}

/**
 * Lee el formulario de horario semanal: por cada día hay dos tramos opcionales
 * (mañana y tarde). Campos: d{dia}_{1|2}_ini y d{dia}_{1|2}_fin.
 */
export function leerHorarioSemanal(datos: FormData): TramoNuevo[] {
  const tramos: TramoNuevo[] = [];
  for (let dia = 1; dia <= 7; dia++) {
    let finAnterior = -1;
    for (const n of [1, 2]) {
      const ini = String(datos.get(`d${dia}_${n}_ini`) ?? "").trim();
      const fin = String(datos.get(`d${dia}_${n}_fin`) ?? "").trim();
      if (!ini && !fin) continue;
      const nombre = `${NOMBRES_DIAS[dia - 1]} (${n === 1 ? "primer" : "segundo"} tramo)`;
      if (!ini || !fin) throw new ErrorUsuario(`${nombre}: indica la hora de inicio y la de fin.`);
      if (aMinutos(fin) <= aMinutos(ini)) throw new ErrorUsuario(`${nombre}: la hora de fin tiene que ser posterior a la de inicio.`);
      if (aMinutos(ini) < finAnterior) throw new ErrorUsuario(`${nombre}: no puede empezar antes de que acabe el primer tramo.`);
      finAnterior = aMinutos(fin);
      tramos.push({ dia_semana: dia, hora_inicio: ini, hora_fin: fin });
    }
  }
  return tramos;
}

/** Agrupa los tramos guardados por día para rellenar el formulario */
export function tramosPorDia(tramos: Pick<Tramo, "dia_semana" | "hora_inicio" | "hora_fin">[]) {
  const porDia: Record<number, { ini: string; fin: string }[]> = {};
  for (const t of [...tramos].sort((a, b) => a.hora_inicio.localeCompare(b.hora_inicio))) {
    (porDia[t.dia_semana] ??= []).push({ ini: t.hora_inicio.slice(0, 5), fin: t.hora_fin.slice(0, 5) });
  }
  return porDia;
}
