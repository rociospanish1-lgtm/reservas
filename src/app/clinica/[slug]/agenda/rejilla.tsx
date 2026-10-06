import Link from "next/link";
import { deMinutos, minutosDelDia, horaLocal } from "@/lib/fechas";
import { NOMBRE_ESTADO, type EstadoCita } from "@/lib/tipos";

/** Píxeles por minuto en la rejilla de la agenda */
const PX = 1.6;

export interface CitaRejilla {
  id: string;
  inicio: string;
  fin: string;
  estado: EstadoCita;
  clienta: string;
  tratamiento: string;
  color: string;
  detalle?: string;
}

export interface ColumnaRejilla {
  clave: string;
  titulo: string;
  subtitulo?: string;
  color?: string;
  /** Tramos disponibles (minutos desde medianoche); fuera de ellos se ve gris */
  disponible: { desde: number; hasta: number }[];
  /** Bloqueos visibles (ausencias), en minutos */
  bloqueos: { desde: number; hasta: number; texto: string }[];
  citas: CitaRejilla[];
  /** Si se indica, los huecos vacíos enlazan a "nueva cita" con estos datos */
  enlaceNueva?: (hora: string) => string;
  aviso?: string;
}

export function RejillaAgenda({
  columnas,
  desde,
  hasta,
  zona,
}: {
  columnas: ColumnaRejilla[];
  /** Minutos desde medianoche */
  desde: number;
  hasta: number;
  zona: string;
}) {
  const alto = (hasta - desde) * PX;
  const horas: number[] = [];
  for (let m = Math.ceil(desde / 60) * 60; m <= hasta; m += 60) horas.push(m);
  const medias: number[] = [];
  for (let m = desde; m < hasta; m += 30) medias.push(m);
  const recortar = (m: number) => Math.min(Math.max(m, desde), hasta);

  return (
    <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
      <div className="grid" style={{ gridTemplateColumns: `3.5rem repeat(${columnas.length}, minmax(9rem, 1fr))` }}>
        {/* Cabecera */}
        <div className="sticky left-0 z-20 border-b border-stone-200 bg-white" />
        {columnas.map((c) => (
          <div key={c.clave} className="border-b border-l border-stone-200 px-2 py-2 text-center">
            <p className="flex items-center justify-center gap-1.5 text-sm font-semibold text-stone-800">
              {c.color && <span className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: c.color }} />}
              {c.titulo}
            </p>
            {c.subtitulo && <p className="text-xs text-stone-500">{c.subtitulo}</p>}
            {c.aviso && <p className="text-xs font-medium text-amber-700">{c.aviso}</p>}
          </div>
        ))}

        {/* Columna de horas */}
        <div className="sticky left-0 z-20 bg-white" style={{ height: alto }}>
          <div className="relative h-full">
            {horas.map((m) => (
              <span key={m} className="absolute right-2 -translate-y-1/2 text-xs text-stone-400" style={{ top: (m - desde) * PX }}>
                {deMinutos(m)}
              </span>
            ))}
          </div>
        </div>

        {columnas.map((c) => (
          <div key={c.clave} className="relative border-l border-stone-200 bg-stone-100" style={{ height: alto }}>
            {/* Horas disponibles en blanco */}
            {c.disponible.map((t, i) => (
              <div
                key={i}
                className="absolute inset-x-0 bg-white"
                style={{ top: (recortar(t.desde) - desde) * PX, height: (recortar(t.hasta) - recortar(t.desde)) * PX }}
              />
            ))}
            {/* Líneas de cada hora */}
            {horas.map((m) => (
              <div key={m} className="pointer-events-none absolute inset-x-0 border-t border-stone-200" style={{ top: (m - desde) * PX }} />
            ))}
            {/* Huecos para crear cita */}
            {c.enlaceNueva &&
              medias.map((m) => (
                <Link
                  key={m}
                  href={c.enlaceNueva!(deMinutos(m))}
                  className="absolute inset-x-0 hover:bg-marca-50"
                  style={{ top: (m - desde) * PX, height: 30 * PX }}
                  aria-label={`Nueva cita a las ${deMinutos(m)}`}
                />
              ))}
            {/* Ausencias */}
            {c.bloqueos.map((b, i) => (
              <div
                key={i}
                className="absolute inset-x-0 flex items-start justify-center bg-[repeating-linear-gradient(45deg,#e7e5e4,#e7e5e4_6px,#f5f5f4_6px,#f5f5f4_12px)] pt-1 text-xs text-stone-600"
                style={{ top: (recortar(b.desde) - desde) * PX, height: Math.max((recortar(b.hasta) - recortar(b.desde)) * PX, 0) }}
              >
                {b.texto}
              </div>
            ))}
            {/* Citas */}
            {c.citas.map((cita) => {
              const ini = recortar(minutosDelDia(cita.inicio, zona));
              const finMin = recortar(minutosDelDia(cita.fin, zona) || 24 * 60);
              const cancelada = cita.estado === "cancelada";
              return (
                <Link
                  key={cita.id}
                  href={cita.detalle ?? "#"}
                  className={`absolute left-1 right-1 overflow-hidden rounded-md border-l-4 px-1.5 py-0.5 text-xs leading-tight shadow-sm hover:brightness-95 ${
                    cancelada ? "z-0 opacity-50 line-through" : "z-10"
                  }`}
                  style={{
                    top: (ini - desde) * PX + 1,
                    height: Math.max((finMin - ini) * PX - 2, 14),
                    backgroundColor: `${cita.color}26`,
                    borderLeftColor: cita.color,
                  }}
                  title={`${horaLocal(cita.inicio, zona)}–${horaLocal(cita.fin, zona)} · ${cita.clienta} · ${cita.tratamiento} · ${NOMBRE_ESTADO[cita.estado]}`}
                >
                  <span className="font-semibold text-stone-900">
                    {horaLocal(cita.inicio, zona)} {cita.clienta}
                  </span>
                  <span className="block truncate text-stone-700">{cita.tratamiento}</span>
                  {cita.estado !== "confirmada" && !cancelada && (
                    <span className="block text-[10px] font-medium uppercase text-stone-500">{NOMBRE_ESTADO[cita.estado]}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
