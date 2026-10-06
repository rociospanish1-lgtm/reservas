import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo, Etiqueta, Seccion, Titulo } from "@/components/ui";
import { obtenerContextoClinica } from "@/lib/sesion";
import { fechaHora, fechaLocal, horaLocal } from "@/lib/fechas";
import { formatearTelefono } from "@/lib/telefono";
import { NOMBRE_ESTADO, NOMBRE_ORIGEN, type Cita, type EstadoCita, type Profesional } from "@/lib/tipos";
import { cambiarEstadoCita, guardarNotasCita, moverCita } from "../../acciones";

type CitaCompleta = Cita & {
  clientas: { id: string; nombre: string; telefono: string | null } | null;
  tratamientos: { nombre: string; duracion_min: number } | null;
  profesionales: { nombre: string; color: string } | null;
  cabinas: { nombre: string } | null;
};

const COLOR_ESTADO: Record<EstadoCita, "stone" | "verde" | "ambar" | "rojo" | "marca"> = {
  pendiente: "ambar",
  confirmada: "verde",
  cancelada: "rojo",
  no_presentada: "rojo",
  completada: "stone",
};

export default async function PaginaCita({ params }: PageProps<"/clinica/[slug]/agenda/cita/[id]">) {
  const { slug, id } = await params;
  const { supabase, clinica, esAdmin } = await obtenerContextoClinica(slug);
  const tz = clinica.zona_horaria;

  const { data } = await supabase
    .from("citas")
    .select("*, clientas(id, nombre, telefono), tratamientos(nombre, duracion_min), profesionales(nombre, color), cabinas(nombre)")
    .eq("id", id)
    .eq("clinica_id", clinica.id)
    .maybeSingle();
  if (!data) notFound();
  const cita = data as unknown as CitaCompleta;

  const { data: profs } = esAdmin
    ? await supabase.from("profesionales").select("*").eq("clinica_id", clinica.id).eq("activa", true).order("nombre")
    : { data: [] };

  const cambiosEstado: EstadoCita[] =
    cita.estado === "cancelada"
      ? []
      : (["confirmada", "completada", "no_presentada"] as EstadoCita[]).filter((e) => e !== cita.estado);
  const fecha = fechaLocal(cita.inicio, tz);

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <Link href={`/clinica/${slug}/agenda?fecha=${fecha}`} className="enlace text-sm">
        ← Agenda del día
      </Link>
      <Titulo accion={<Etiqueta color={COLOR_ESTADO[cita.estado]}>{NOMBRE_ESTADO[cita.estado]}</Etiqueta>}>
        {cita.tratamientos?.nombre}
      </Titulo>

      <section className="tarjeta grid gap-3 text-sm sm:grid-cols-2">
        <p>
          <span className="block text-stone-500">Cuándo</span>
          <span className="font-medium">
            {fechaHora(cita.inicio, tz)} – {horaLocal(cita.fin, tz)}
          </span>
        </p>
        <p>
          <span className="block text-stone-500">Clienta</span>
          {cita.clientas ? (
            <Link href={`/clinica/${slug}/clientas/${cita.clientas.id}`} className="enlace">
              {cita.clientas.nombre}
            </Link>
          ) : (
            "—"
          )}
          {cita.clientas?.telefono && <span className="text-stone-600"> · {formatearTelefono(cita.clientas.telefono)}</span>}
        </p>
        <p>
          <span className="block text-stone-500">Profesional</span>
          <span className="font-medium">{cita.profesionales?.nombre}</span>
        </p>
        <p>
          <span className="block text-stone-500">Cabina</span>
          <span className="font-medium">{cita.cabinas?.nombre ?? "No necesita"}</span>
        </p>
        <p>
          <span className="block text-stone-500">Reservada desde</span>
          <span className="font-medium">{NOMBRE_ORIGEN[cita.origen]}</span>
          <span className="text-stone-500"> · {fechaHora(cita.created_at, tz)}</span>
        </p>
        {cita.estado === "cancelada" && (
          <p>
            <span className="block text-stone-500">Cancelada por</span>
            <span className="font-medium">{cita.cancelada_por === "clienta" ? "La clienta" : cita.cancelada_por === "asistente" ? "El asistente" : "La clínica"}</span>
          </p>
        )}
      </section>

      {cambiosEstado.length > 0 && (
        <Seccion titulo="Cambiar estado">
          <div className="flex flex-wrap gap-2">
            {cambiosEstado.map((e) => (
              <form key={e} action={cambiarEstadoCita.bind(null, slug, cita.id, e)}>
                <button className="boton-secundario">Marcar como {NOMBRE_ESTADO[e].toLowerCase()}</button>
              </form>
            ))}
          </div>
        </Seccion>
      )}

      <Seccion titulo="Notas de la cita">
        <Formulario accion={guardarNotasCita.bind(null, slug, cita.id)} className="space-y-3">
          <textarea className="campo" rows={3} name="notas" defaultValue={cita.notas ?? ""} aria-label="Notas de la cita" />
          <BotonEnviar variante="secundario">Guardar notas</BotonEnviar>
        </Formulario>
      </Seccion>

      {esAdmin && cita.estado !== "cancelada" && (
        <>
          <Seccion titulo="Mover la cita" descripcion="Se mantiene la duración del tratamiento. Nunca se podrá solapar con otra cita.">
            <Formulario accion={moverCita.bind(null, slug, cita.id)} className="grid gap-3 sm:grid-cols-4 sm:items-end">
              <Campo etiqueta="Día">
                <input className="campo" type="date" name="fecha" defaultValue={fecha} required />
              </Campo>
              <Campo etiqueta="Hora">
                <input className="campo" type="time" name="hora" step={300} defaultValue={horaLocal(cita.inicio, tz)} required />
              </Campo>
              <Campo etiqueta="Profesional">
                <select className="campo" name="profesional_id" defaultValue={cita.profesional_id}>
                  {((profs ?? []) as Profesional[]).map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nombre}
                    </option>
                  ))}
                </select>
              </Campo>
              <BotonEnviar variante="secundario">Mover</BotonEnviar>
            </Formulario>
          </Seccion>

          <Seccion titulo="Cancelar la cita" descripcion="El hueco queda libre para otra clienta.">
            <form action={cambiarEstadoCita.bind(null, slug, cita.id, "cancelada")}>
              <button className="boton-peligro">Cancelar cita</button>
            </form>
          </Seccion>
        </>
      )}
    </div>
  );
}
