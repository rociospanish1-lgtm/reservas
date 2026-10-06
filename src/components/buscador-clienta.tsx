"use client";

import { useEffect, useState, useTransition } from "react";
import { formatearTelefono } from "@/lib/telefono";

interface Resultado {
  id: string;
  nombre: string;
  telefono: string | null;
}

/**
 * Busca una clienta por nombre o teléfono y guarda su id en un campo oculto.
 * Si se indica permitirNueva, ofrece crear una clienta nueva en el momento.
 */
export function BuscadorClienta({
  buscar,
  nombreCampo = "clienta_id",
  permitirNueva = false,
  excluirId,
}: {
  buscar: (consulta: string) => Promise<Resultado[]>;
  nombreCampo?: string;
  permitirNueva?: boolean;
  excluirId?: string;
}) {
  const [consulta, setConsulta] = useState("");
  const [resultados, setResultados] = useState<Resultado[]>([]);
  const [elegida, setElegida] = useState<Resultado | null>(null);
  const [nueva, setNueva] = useState(false);
  const [buscando, empezar] = useTransition();

  const buscable = !elegida && !nueva && consulta.trim().length >= 2;
  const visibles = buscable ? resultados : [];

  useEffect(() => {
    if (!buscable) return;
    const t = setTimeout(() => {
      empezar(async () => {
        const r = await buscar(consulta);
        setResultados(r.filter((x) => x.id !== excluirId));
      });
    }, 250);
    return () => clearTimeout(t);
  }, [consulta, buscable, buscar, excluirId]);

  if (elegida) {
    return (
      <div className="flex items-center justify-between rounded-lg border border-marca-200 bg-marca-50 px-3 py-2 text-sm">
        <span>
          <span className="font-medium">{elegida.nombre}</span>
          {elegida.telefono && <span className="text-stone-600"> · {formatearTelefono(elegida.telefono)}</span>}
        </span>
        <input type="hidden" name={nombreCampo} value={elegida.id} />
        <button type="button" className="enlace" onClick={() => setElegida(null)}>
          Cambiar
        </button>
      </div>
    );
  }

  if (nueva) {
    return (
      <div className="space-y-3 rounded-lg border border-stone-200 p-3">
        <div className="flex items-center justify-between">
          <p className="text-sm font-medium">Clienta nueva</p>
          <button type="button" className="enlace text-sm" onClick={() => setNueva(false)}>
            Buscar una existente
          </button>
        </div>
        <input className="campo" name="nueva_nombre" placeholder="Nombre y apellidos" defaultValue={consulta} required aria-label="Nombre" />
        <div className="grid gap-3 sm:grid-cols-2">
          <input className="campo" name="nueva_telefono" placeholder="Teléfono (612 345 678)" inputMode="tel" aria-label="Teléfono" />
          <input className="campo" name="nueva_email" type="email" placeholder="Email (opcional)" aria-label="Email" />
        </div>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="nueva_consentimiento" className="mt-0.5" />
          La clienta ha aceptado la política de privacidad de la clínica.
        </label>
      </div>
    );
  }

  return (
    <div>
      <input
        className="campo"
        placeholder="Busca por nombre o teléfono…"
        value={consulta}
        onChange={(e) => setConsulta(e.target.value)}
        aria-label="Buscar clienta"
      />
      {buscando && <p className="mt-1 text-xs text-stone-500">Buscando…</p>}
      {visibles.length > 0 && (
        <ul className="mt-1 divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white shadow-sm">
          {visibles.map((r) => (
            <li key={r.id}>
              <button type="button" className="w-full px-3 py-2 text-left text-sm hover:bg-stone-50" onClick={() => setElegida(r)}>
                <span className="font-medium">{r.nombre}</span>
                {r.telefono && <span className="text-stone-600"> · {formatearTelefono(r.telefono)}</span>}
              </button>
            </li>
          ))}
        </ul>
      )}
      {permitirNueva && (
        <button type="button" className="enlace mt-2 text-sm" onClick={() => setNueva(true)}>
          + Es una clienta nueva
        </button>
      )}
    </div>
  );
}
