import Link from "next/link";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { BuscadorClienta } from "@/components/buscador-clienta";
import { Campo, Titulo } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import { hoyEn } from "@/lib/fechas";
import type { Profesional, Tratamiento } from "@/lib/tipos";
import { buscarClientas, crearCita } from "../acciones";

export const metadata = { title: "Nueva cita" };

export default async function PaginaNuevaCita({ params, searchParams }: PageProps<"/clinica/[slug]/agenda/nueva">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, clinica } = await requerirAdminPagina(slug);
  const [{ data: tratamientos }, { data: profesionales }] = await Promise.all([
    supabase.from("tratamientos").select("*").eq("clinica_id", clinica.id).eq("activo", true).order("orden").order("nombre"),
    supabase.from("profesionales").select("*").eq("clinica_id", clinica.id).eq("activa", true).order("orden").order("nombre"),
  ]);
  const valor = (k: string) => (typeof sp[k] === "string" ? (sp[k] as string) : "");

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clinica/${slug}/agenda${valor("fecha") ? `?fecha=${valor("fecha")}` : ""}`} className="enlace text-sm">
        ← Agenda
      </Link>
      <Titulo>Nueva cita</Titulo>
      <Formulario accion={crearCita.bind(null, slug)} className="tarjeta space-y-4">
        <Campo etiqueta="Clienta">
          <BuscadorClienta buscar={buscarClientas.bind(null, slug)} permitirNueva />
        </Campo>
        <div className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Tratamiento">
            <select className="campo" name="tratamiento_id" required defaultValue="">
              <option value="" disabled>
                Elige…
              </option>
              {((tratamientos ?? []) as Tratamiento[]).map((t) => (
                <option key={t.id} value={t.id}>
                  {t.nombre} ({t.duracion_min} min)
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Profesional">
            <select className="campo" name="profesional_id" required defaultValue={valor("profesional")}>
              <option value="" disabled>
                Elige…
              </option>
              {((profesionales ?? []) as Profesional[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Día">
            <input className="campo" type="date" name="fecha" required defaultValue={valor("fecha") || hoyEn(clinica.zona_horaria)} />
          </Campo>
          <Campo etiqueta="Hora">
            <input className="campo" type="time" name="hora" step={300} required defaultValue={valor("hora")} />
          </Campo>
          <Campo etiqueta="Estado">
            <select className="campo" name="estado" defaultValue="confirmada">
              <option value="confirmada">Confirmada</option>
              <option value="pendiente">Pendiente</option>
            </select>
          </Campo>
        </div>
        <Campo etiqueta="Notas de la cita (opcional)">
          <textarea className="campo" rows={2} name="notas" />
        </Campo>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="forzar" className="mt-0.5" />
          <span>
            Permitir fuera de horario
            <span className="block text-xs text-stone-500">
              Para dar una cita fuera del horario de la profesional o en un hueco que no encaja. Nunca permite que se solape con otra cita.
            </span>
          </span>
        </label>
        <BotonEnviar>Reservar cita</BotonEnviar>
      </Formulario>
    </div>
  );
}
