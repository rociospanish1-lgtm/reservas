import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { EditorHorario } from "@/components/editor-horario";
import { Campo, Seccion, Titulo, Vacio } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import { fechaHora } from "@/lib/fechas";
import type { Ausencia, Profesional, Tramo, Tratamiento } from "@/lib/tipos";
import { anadirAusencia, borrarAusencia, guardarHorarioProfesional, guardarProfesional } from "../../acciones";

export default async function PaginaProfesional({ params }: PageProps<"/clinica/[slug]/configuracion/profesionales/[id]">) {
  const { slug, id } = await params;
  const { supabase, clinica } = await requerirAdminPagina(slug);

  const { data: profesional } = await supabase
    .from("profesionales")
    .select("*")
    .eq("id", id)
    .eq("clinica_id", clinica.id)
    .maybeSingle<Profesional>();
  if (!profesional) notFound();

  const [{ data: horario }, { data: tratamientos }, { data: suyos }, { data: ausencias }] = await Promise.all([
    supabase.from("horarios_profesional").select("*").eq("profesional_id", id),
    supabase.from("tratamientos").select("id, nombre, activo").eq("clinica_id", clinica.id).order("orden").order("nombre"),
    supabase.from("tratamiento_profesionales").select("tratamiento_id").eq("profesional_id", id),
    supabase
      .from("ausencias_profesional")
      .select("*")
      .eq("profesional_id", id)
      .gte("fin", new Date().toISOString())
      .order("inicio"),
  ]);
  const hace = new Set((suyos ?? []).map((t) => t.tratamiento_id));
  const tz = clinica.zona_horaria;

  return (
    <div className="space-y-6">
      <Link href={`/clinica/${slug}/configuracion/profesionales`} className="enlace text-sm">
        ← Profesionales
      </Link>
      <Titulo>{profesional.nombre}</Titulo>

      <Seccion titulo="Datos y tratamientos que hace">
        <Formulario accion={guardarProfesional.bind(null, slug, id)} className="space-y-4">
          <div className="flex flex-wrap items-end gap-3">
            <Campo etiqueta="Nombre" className="min-w-48 flex-1">
              <input className="campo" name="nombre" defaultValue={profesional.nombre} required />
            </Campo>
            <Campo etiqueta="Color">
              <input className="h-10 w-16 cursor-pointer rounded-lg border border-stone-300" type="color" name="color" defaultValue={profesional.color} />
            </Campo>
            <label className="flex items-center gap-2 pb-2 text-sm">
              <input type="checkbox" name="activa" defaultChecked={profesional.activa} /> Activa (aparece en la agenda y en las reservas)
            </label>
          </div>
          <fieldset>
            <legend className="etiqueta">Tratamientos que hace</legend>
            {(tratamientos ?? []).length === 0 ? (
              <p className="text-sm text-stone-500">Todavía no hay tratamientos.</p>
            ) : (
              <div className="grid gap-2 sm:grid-cols-2">
                {((tratamientos ?? []) as Pick<Tratamiento, "id" | "nombre" | "activo">[]).map((t) => (
                  <label key={t.id} className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="tratamientos" value={t.id} defaultChecked={hace.has(t.id)} />
                    {t.nombre}
                    {!t.activo && <span className="text-stone-400">(inactivo)</span>}
                  </label>
                ))}
              </div>
            )}
          </fieldset>
          <BotonEnviar>Guardar</BotonEnviar>
        </Formulario>
      </Seccion>

      <Seccion titulo="Horario de trabajo" descripcion="Solo se ofrecen huecos cuando trabaja ella y la clínica está abierta.">
        <Formulario accion={guardarHorarioProfesional.bind(null, slug, id)}>
          <EditorHorario tramos={(horario ?? []) as Tramo[]} />
          <BotonEnviar className="mt-4">Guardar horario</BotonEnviar>
        </Formulario>
      </Seccion>

      <Seccion titulo="Vacaciones y ausencias" descripcion="Durante una ausencia no se ofrecen huecos con ella. Las citas que ya tenga no se mueven solas.">
        {(ausencias ?? []).length === 0 ? (
          <Vacio>No hay ausencias próximas.</Vacio>
        ) : (
          <ul className="divide-y divide-stone-100">
            {((ausencias ?? []) as Ausencia[]).map((a) => (
              <li key={a.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  {fechaHora(a.inicio, tz)} → {fechaHora(a.fin, tz)}
                  {a.motivo && <span className="text-stone-600"> · {a.motivo}</span>}
                </span>
                <form action={borrarAusencia.bind(null, slug, id, a.id)}>
                  <button className="enlace text-red-700">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Formulario accion={anadirAusencia.bind(null, slug, id)} limpiarAlTerminar className="mt-4 grid gap-3 sm:grid-cols-5 sm:items-end">
          <Campo etiqueta="Desde el día">
            <input className="campo" type="date" name="desde" required />
          </Campo>
          <Campo etiqueta="Hora (opcional)">
            <input className="campo" type="time" name="hora_desde" />
          </Campo>
          <Campo etiqueta="Hasta el día">
            <input className="campo" type="date" name="hasta" />
          </Campo>
          <Campo etiqueta="Hora (opcional)">
            <input className="campo" type="time" name="hora_hasta" />
          </Campo>
          <Campo etiqueta="Motivo">
            <input className="campo" name="motivo" placeholder="Vacaciones" />
          </Campo>
          <div className="sm:col-span-5">
            <BotonEnviar variante="secundario">Añadir ausencia</BotonEnviar>
          </div>
        </Formulario>
      </Seccion>
    </div>
  );
}
