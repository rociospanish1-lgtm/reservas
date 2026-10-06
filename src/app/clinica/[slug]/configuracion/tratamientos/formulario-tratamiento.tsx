import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo } from "@/components/ui";
import type { EstadoAccion } from "@/lib/errores";
import type { Cabina, Profesional, Tratamiento } from "@/lib/tipos";

const HUECOS_FAQ = 6;

export function FormularioTratamiento({
  accion,
  tratamiento,
  profesionales,
  cabinas,
  profesionalesMarcadas,
  cabinasMarcadas,
}: {
  accion: (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;
  tratamiento: Tratamiento | null;
  profesionales: Profesional[];
  cabinas: Cabina[];
  profesionalesMarcadas: Set<string>;
  cabinasMarcadas: Set<string>;
}) {
  const t = tratamiento;
  const faqs = [...(t?.preguntas_frecuentes ?? [])];
  while (faqs.length < Math.max(HUECOS_FAQ, faqs.length + 2)) faqs.push({ pregunta: "", respuesta: "" });

  return (
    <Formulario accion={accion} className="space-y-6">
      <section className="tarjeta grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Nombre" className="sm:col-span-3">
          <input className="campo" name="nombre" defaultValue={t?.nombre} required />
        </Campo>
        <Campo etiqueta="Duración (minutos)">
          <input className="campo" type="number" name="duracion_min" min={5} max={480} step={5} defaultValue={t?.duracion_min ?? 60} required />
        </Campo>
        <Campo etiqueta="Precio (€)" ayuda="Déjalo vacío si no quieres que el asistente dé precio.">
          <input className="campo" name="precio" inputMode="decimal" defaultValue={t?.precio ?? ""} />
        </Campo>
        <Campo etiqueta="Sesiones recomendadas" ayuda="Vacío si es una sola sesión.">
          <input className="campo" type="number" name="sesiones_recomendadas" min={1} max={100} defaultValue={t?.sesiones_recomendadas ?? ""} />
        </Campo>
        <div className="flex flex-wrap gap-6 text-sm sm:col-span-3">
          <label className="flex items-center gap-2">
            <input type="checkbox" name="precio_desde" defaultChecked={t?.precio_desde} /> El precio es «desde»
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="activo" defaultChecked={t?.activo ?? true} /> Activo
          </label>
          <label className="flex items-center gap-2">
            <input type="checkbox" name="reservable_online" defaultChecked={t?.reservable_online ?? true} /> Se puede reservar online
          </label>
        </div>
      </section>

      <section className="tarjeta grid gap-4">
        <h2 className="font-semibold">Información para las clientas</h2>
        <Campo etiqueta="Descripción">
          <textarea className="campo" rows={3} name="descripcion" defaultValue={t?.descripcion ?? ""} />
        </Campo>
        <Campo etiqueta="Preparación previa">
          <textarea className="campo" rows={2} name="preparacion" defaultValue={t?.preparacion ?? ""} />
        </Campo>
        <Campo etiqueta="Cuidados posteriores">
          <textarea className="campo" rows={2} name="cuidados_posteriores" defaultValue={t?.cuidados_posteriores ?? ""} />
        </Campo>
        <Campo
          etiqueta="Contraindicaciones generales"
          ayuda="El asistente nunca diagnostica: ante una duda concreta de salud recomendará una valoración en la clínica."
        >
          <textarea className="campo" rows={2} name="contraindicaciones" defaultValue={t?.contraindicaciones ?? ""} />
        </Campo>
        <fieldset>
          <legend className="etiqueta">Preguntas frecuentes</legend>
          <div className="space-y-3">
            {faqs.map((f, i) => (
              <div key={i} className="grid gap-2 sm:grid-cols-2">
                <input className="campo" name="faq_pregunta" defaultValue={f.pregunta} placeholder="Pregunta" aria-label={`Pregunta ${i + 1}`} />
                <input className="campo" name="faq_respuesta" defaultValue={f.respuesta} placeholder="Respuesta" aria-label={`Respuesta ${i + 1}`} />
              </div>
            ))}
          </div>
        </fieldset>
      </section>

      <section className="tarjeta grid gap-6 sm:grid-cols-2">
        <fieldset>
          <legend className="etiqueta">Profesionales que lo hacen</legend>
          {profesionales.map((p) => (
            <label key={p.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" name="profesionales" value={p.id} defaultChecked={profesionalesMarcadas.has(p.id)} />
              {p.nombre}
              {!p.activa && <span className="text-stone-400">(inactiva)</span>}
            </label>
          ))}
          {profesionales.length === 0 && <p className="text-sm text-stone-500">No hay profesionales todavía.</p>}
        </fieldset>
        <fieldset>
          <legend className="etiqueta">Cabinas donde se puede hacer</legend>
          <p className="mb-1 text-xs text-stone-500">Si no marcas ninguna, no necesita cabina.</p>
          {cabinas.map((c) => (
            <label key={c.id} className="flex items-center gap-2 py-1 text-sm">
              <input type="checkbox" name="cabinas" value={c.id} defaultChecked={cabinasMarcadas.has(c.id)} />
              {c.nombre}
              {!c.activa && <span className="text-stone-400">(inactiva)</span>}
            </label>
          ))}
          {cabinas.length === 0 && <p className="text-sm text-stone-500">No hay cabinas.</p>}
        </fieldset>
      </section>

      <BotonEnviar>{t ? "Guardar tratamiento" : "Crear tratamiento"}</BotonEnviar>
    </Formulario>
  );
}
