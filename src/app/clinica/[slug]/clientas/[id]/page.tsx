import Link from "next/link";
import { notFound } from "next/navigation";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { BuscadorClienta } from "@/components/buscador-clienta";
import { Campo, Etiqueta, Seccion, Titulo, Vacio } from "@/components/ui";
import { obtenerContextoClinica } from "@/lib/sesion";
import { fechaHora } from "@/lib/fechas";
import { formatearTelefono } from "@/lib/telefono";
import { NOMBRE_ESTADO, NOMBRE_ORIGEN, type Cita, type Clienta } from "@/lib/tipos";
import { buscarClientas } from "../../agenda/acciones";
import { borrarDatosClienta, fusionarClienta, guardarClienta, guardarNotasClinicas } from "../acciones";

type CitaHistorial = Cita & {
  tratamientos: { nombre: string } | null;
  profesionales: { nombre: string } | null;
};

const VIA: Record<string, string> = { web: "la web", whatsapp: "WhatsApp", panel: "el panel", importacion: "la importación" };

export default async function PaginaClienta({ params }: PageProps<"/clinica/[slug]/clientas/[id]">) {
  const { slug, id } = await params;
  const { supabase, clinica, esAdmin } = await obtenerContextoClinica(slug);
  const tz = clinica.zona_horaria;

  const { data } = await supabase.from("clientas").select("*").eq("id", id).eq("clinica_id", clinica.id).maybeSingle<Clienta>();
  if (!data) notFound();
  const clienta = data;

  const [{ data: citasData }, { data: notas }, { data: principal }, { data: dependientes }] = await Promise.all([
    supabase
      .from("citas")
      .select("*, tratamientos(nombre), profesionales(nombre)")
      .eq("clienta_id", id)
      .order("inicio", { ascending: false }),
    supabase.from("notas_clinicas").select("texto, updated_at").eq("clienta_id", id).maybeSingle(),
    clienta.contacto_principal_id
      ? supabase.from("clientas").select("id, nombre").eq("id", clienta.contacto_principal_id).maybeSingle()
      : Promise.resolve({ data: null }),
    supabase.from("clientas").select("id, nombre").eq("contacto_principal_id", id),
  ]);
  const citas = (citasData ?? []) as unknown as CitaHistorial[];
  const ahora = new Date().toISOString();
  const proximas = citas.filter((c) => c.inicio >= ahora && c.estado !== "cancelada").reverse();
  const pasadas = citas.filter((c) => c.inicio < ahora || c.estado === "cancelada");
  const anonimizada = Boolean(clienta.anonimizada_at);

  const filaCita = (c: CitaHistorial) => (
    <li key={c.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 py-2 text-sm">
      <Link href={`/clinica/${slug}/agenda/cita/${c.id}`} className="enlace">
        {fechaHora(c.inicio, tz)}
      </Link>
      <span>{c.tratamientos?.nombre}</span>
      <span className="text-stone-500">con {c.profesionales?.nombre}</span>
      <Etiqueta color={c.estado === "completada" || c.estado === "confirmada" ? "verde" : c.estado === "pendiente" ? "ambar" : "rojo"}>
        {NOMBRE_ESTADO[c.estado]}
      </Etiqueta>
      <span className="text-xs text-stone-400">{NOMBRE_ORIGEN[c.origen]}</span>
    </li>
  );

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <Link href={`/clinica/${slug}/clientas`} className="enlace text-sm">
        ← Clientas
      </Link>
      <Titulo
        accion={
          esAdmin &&
          !anonimizada && (
            <Link href={`/clinica/${slug}/agenda/nueva`} className="boton-secundario">
              Nueva cita
            </Link>
          )
        }
      >
        {clienta.nombre}
      </Titulo>

      {anonimizada && (
        <p className="rounded-lg bg-stone-100 px-4 py-3 text-sm text-stone-700">
          Los datos personales de esta clienta se borraron el {fechaHora(clienta.anonimizada_at!, tz)} a petición suya.
          Sus citas pasadas se conservan sin nombre para las estadísticas.
        </p>
      )}

      {!anonimizada && (
        <section className="tarjeta space-y-1 text-sm">
          <p>
            <span className="text-stone-500">Teléfono: </span>
            {clienta.telefono ? formatearTelefono(clienta.telefono) : "—"}
          </p>
          <p>
            <span className="text-stone-500">Privacidad: </span>
            {clienta.consentimiento_privacidad_at
              ? `aceptada el ${fechaHora(clienta.consentimiento_privacidad_at, tz)} desde ${VIA[clienta.consentimiento_via ?? ""] ?? "—"}`
              : "pendiente de aceptar"}
          </p>
          {principal && (
            <p>
              <span className="text-stone-500">Reserva desde el teléfono de: </span>
              <Link href={`/clinica/${slug}/clientas/${principal.id}`} className="enlace">
                {principal.nombre}
              </Link>
            </p>
          )}
          {(dependientes ?? []).length > 0 && (
            <p>
              <span className="text-stone-500">También reserva para: </span>
              {(dependientes ?? []).map((d, i) => (
                <span key={d.id}>
                  {i > 0 && ", "}
                  <Link href={`/clinica/${slug}/clientas/${d.id}`} className="enlace">
                    {d.nombre}
                  </Link>
                </span>
              ))}
            </p>
          )}
        </section>
      )}

      <Seccion titulo="Próximas citas">
        {proximas.length === 0 ? <Vacio>No tiene citas próximas.</Vacio> : <ul className="divide-y divide-stone-100">{proximas.map(filaCita)}</ul>}
      </Seccion>

      <Seccion titulo="Historial">
        {pasadas.length === 0 ? <Vacio>Todavía no tiene historial.</Vacio> : <ul className="divide-y divide-stone-100">{pasadas.map(filaCita)}</ul>}
      </Seccion>

      {!anonimizada && (
        <Seccion
          titulo="Notas clínicas"
          descripcion="Alergias, medicación, embarazo… Solo las ve el personal. Nunca se envían al asistente de IA."
        >
          <Formulario accion={guardarNotasClinicas.bind(null, slug, id)} className="space-y-3">
            <textarea className="campo" rows={4} name="texto" defaultValue={notas?.texto ?? ""} aria-label="Notas clínicas" />
            <BotonEnviar variante="secundario">Guardar notas clínicas</BotonEnviar>
          </Formulario>
        </Seccion>
      )}

      {esAdmin && !anonimizada && (
        <>
          <Seccion titulo="Datos de la ficha">
            <Formulario accion={guardarClienta.bind(null, slug, id)} className="grid gap-4 sm:grid-cols-2">
              <Campo etiqueta="Nombre y apellidos" className="sm:col-span-2">
                <input className="campo" name="nombre" defaultValue={clienta.nombre} required />
              </Campo>
              <Campo etiqueta="Teléfono">
                <input className="campo" name="telefono" inputMode="tel" defaultValue={clienta.telefono ?? ""} />
              </Campo>
              <Campo etiqueta="Email">
                <input className="campo" type="email" name="email" defaultValue={clienta.email ?? ""} />
              </Campo>
              <Campo
                etiqueta="Notas para el asistente (sin datos de salud)"
                className="sm:col-span-2"
                ayuda="Preferencias que el asistente tendrá en cuenta. Nunca se le leen a la clienta."
              >
                <textarea className="campo" rows={2} name="notas_asistente" defaultValue={clienta.notas_asistente ?? ""} />
              </Campo>
              {!clienta.consentimiento_privacidad_at && (
                <label className="flex items-start gap-2 text-sm sm:col-span-2">
                  <input type="checkbox" name="registrar_consentimiento" className="mt-0.5" />
                  La clienta ha aceptado ahora la política de privacidad.
                </label>
              )}
              <div className="sm:col-span-2">
                <BotonEnviar>Guardar ficha</BotonEnviar>
              </div>
            </Formulario>
          </Seccion>

          <Seccion
            titulo="Fusionar con una ficha duplicada"
            descripcion="Busca la otra ficha de esta misma clienta. Sus citas y datos pasarán a esta ficha y la duplicada desaparecerá."
          >
            <Formulario
              accion={fusionarClienta.bind(null, slug, id)}
              confirmar="¿Seguro? La ficha duplicada desaparecerá y sus citas pasarán a esta."
              className="space-y-3"
            >
              <BuscadorClienta buscar={buscarClientas.bind(null, slug)} nombreCampo="duplicada_id" excluirId={id} />
              <BotonEnviar variante="secundario">Fusionar</BotonEnviar>
            </Formulario>
          </Seccion>

          <Seccion
            titulo="Borrar datos personales (derecho de supresión)"
            descripcion="Se borran nombre, teléfono, email, notas y conversaciones. Sus citas futuras se cancelan y las pasadas quedan sin nombre para las estadísticas. No se puede deshacer."
          >
            <Formulario accion={borrarDatosClienta.bind(null, slug, id)} className="flex flex-wrap items-end gap-3">
              <Campo etiqueta="Escribe BORRAR para confirmar">
                <input className="campo" name="confirmacion" autoComplete="off" />
              </Campo>
              <BotonEnviar variante="peligro">Borrar datos</BotonEnviar>
            </Formulario>
          </Seccion>
        </>
      )}
    </div>
  );
}
