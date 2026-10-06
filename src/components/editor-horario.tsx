import { NOMBRES_DIAS } from "@/lib/fechas";
import { tramosPorDia } from "@/lib/horarios";
import type { Tramo } from "@/lib/tipos";

/**
 * Tabla para editar un horario semanal con dos tramos por día (mañana y tarde).
 * Un día sin horas = cerrado / no trabaja.
 */
export function EditorHorario({ tramos }: { tramos: Pick<Tramo, "dia_semana" | "hora_inicio" | "hora_fin">[] }) {
  const porDia = tramosPorDia(tramos);
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-stone-500">
            <th className="py-2 pr-4 font-medium">Día</th>
            <th className="py-2 pr-4 font-medium">Primer tramo</th>
            <th className="py-2 font-medium">Segundo tramo (opcional)</th>
          </tr>
        </thead>
        <tbody>
          {NOMBRES_DIAS.map((nombre, i) => {
            const dia = i + 1;
            const t = porDia[dia] ?? [];
            return (
              <tr key={dia} className="border-t border-stone-100">
                <td className="py-2 pr-4 font-medium text-stone-800">{nombre}</td>
                {[1, 2].map((n) => (
                  <td key={n} className="py-2 pr-4">
                    <div className="flex items-center gap-2">
                      <input
                        type="time"
                        step={300}
                        name={`d${dia}_${n}_ini`}
                        defaultValue={t[n - 1]?.ini ?? ""}
                        className="campo w-28"
                        aria-label={`${nombre}, tramo ${n}, desde`}
                      />
                      <span className="text-stone-400">a</span>
                      <input
                        type="time"
                        step={300}
                        name={`d${dia}_${n}_fin`}
                        defaultValue={t[n - 1]?.fin ?? ""}
                        className="campo w-28"
                        aria-label={`${nombre}, tramo ${n}, hasta`}
                      />
                    </div>
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
      <p className="mt-2 text-xs text-stone-500">Deja un día vacío si no se trabaja.</p>
    </div>
  );
}
