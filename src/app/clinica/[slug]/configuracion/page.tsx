import { Formulario, BotonEnviar } from "@/components/formulario";
import { EditorHorario } from "@/components/editor-horario";
import { Campo, Seccion, Titulo, Vacio } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import { fechaCorta } from "@/lib/fechas";
import type { Cierre, Tramo } from "@/lib/tipos";
import { anadirCierre, borrarCierre, guardarDatosClinica, guardarHorarioClinica } from "./acciones";

export default async function PaginaConfiguracion({ params }: PageProps<"/clinica/[slug]/configuracion">) {
  const { slug } = await params;
  const { supabase, clinica } = await requerirAdminPagina(slug);

  const [{ data: horario }, { data: cierres }] = await Promise.all([
    supabase.from("horarios_clinica").select("*").eq("clinica_id", clinica.id),
    supabase
      .from("cierres_clinica")
      .select("*")
      .eq("clinica_id", clinica.id)
      .gte("fecha_fin", new Date().toISOString().slice(0, 10))
      .order("fecha_inicio"),
  ]);

  return (
    <div className="space-y-6">
      <Titulo>Clínica y horario</Titulo>

      <Seccion titulo="Datos de la clínica">
        <Formulario accion={guardarDatosClinica.bind(null, slug)} className="grid gap-4 sm:grid-cols-2">
          <Campo etiqueta="Nombre">
            <input className="campo" name="nombre" defaultValue={clinica.nombre} required />
          </Campo>
          <Campo etiqueta="Teléfono">
            <input className="campo" name="telefono" defaultValue={clinica.telefono ?? ""} />
          </Campo>
          <Campo etiqueta="Dirección" className="sm:col-span-2">
            <input className="campo" name="direccion" defaultValue={clinica.direccion ?? ""} />
          </Campo>
          <Campo etiqueta="Email">
            <input className="campo" type="email" name="email" defaultValue={clinica.email ?? ""} />
          </Campo>
          <Campo etiqueta="Zona horaria">
            <select className="campo" name="zona_horaria" defaultValue={clinica.zona_horaria}>
              <option value="Europe/Madrid">Península y Baleares</option>
              <option value="Atlantic/Canary">Canarias</option>
            </select>
          </Campo>
          <Campo etiqueta="Enlace a la política de privacidad" className="sm:col-span-2" ayuda="Se muestra en la reserva online y lo usa el asistente.">
            <input className="campo" type="url" name="url_politica_privacidad" defaultValue={clinica.url_politica_privacidad ?? ""} placeholder="https://…" />
          </Campo>

          <h3 className="pt-2 font-medium sm:col-span-2">Reservas</h3>
          <Campo etiqueta="Ofrecer huecos cada" ayuda="Por ejemplo, cada 15 minutos: 10:00, 10:15, 10:30…">
            <select className="campo" name="intervalo_huecos_min" defaultValue={String(clinica.intervalo_huecos_min)}>
              {[5, 10, 15, 20, 30, 60].map((m) => (
                <option key={m} value={m}>
                  {m} minutos
                </option>
              ))}
            </select>
          </Campo>
          <Campo etiqueta="Antelación mínima para reservar online (horas)" ayuda="No se ofrecen huecos que empiecen antes de este tiempo.">
            <input className="campo" type="number" min={0} max={720} name="antelacion_horas" defaultValue={Math.round(clinica.antelacion_minima_reserva_min / 60)} />
          </Campo>
          <Campo etiqueta="Horas mínimas para cancelar" ayuda="Lo usará el asistente al hablar de cancelaciones.">
            <input className="campo" type="number" min={0} max={720} name="horas_minimas_cancelacion" defaultValue={clinica.horas_minimas_cancelacion} />
          </Campo>

          <h3 className="pt-2 font-medium sm:col-span-2">Asistente de WhatsApp</h3>
          <Campo etiqueta="Tono del asistente" className="sm:col-span-2" ayuda="Cómo quieres que hable con tus clientas.">
            <textarea className="campo" rows={2} name="tono_asistente" defaultValue={clinica.tono_asistente} />
          </Campo>
          <Campo etiqueta="Instrucciones adicionales (opcional)" className="sm:col-span-2" ayuda="Normas propias: aparcamiento, formas de pago, bonos…">
            <textarea className="campo" rows={3} name="instrucciones_extra_asistente" defaultValue={clinica.instrucciones_extra_asistente ?? ""} />
          </Campo>
          <div className="sm:col-span-2">
            <BotonEnviar>Guardar datos</BotonEnviar>
          </div>
        </Formulario>
      </Seccion>

      <Seccion titulo="Horario de apertura" descripcion="Las profesionales solo pueden tener citas dentro de este horario.">
        <Formulario accion={guardarHorarioClinica.bind(null, slug)}>
          <EditorHorario tramos={(horario ?? []) as Tramo[]} />
          <BotonEnviar className="mt-4">Guardar horario</BotonEnviar>
        </Formulario>
      </Seccion>

      <Seccion titulo="Festivos y cierres" descripcion="Esos días no se ofrecen huecos para reservar.">
        {(cierres ?? []).length === 0 ? (
          <Vacio>No hay cierres próximos.</Vacio>
        ) : (
          <ul className="divide-y divide-stone-100">
            {((cierres ?? []) as Cierre[]).map((c) => (
              <li key={c.id} className="flex items-center justify-between py-2 text-sm">
                <span>
                  <span className="font-medium">
                    {fechaCorta(c.fecha_inicio)}
                    {c.fecha_fin !== c.fecha_inicio && ` – ${fechaCorta(c.fecha_fin)}`}
                  </span>
                  {c.motivo && <span className="text-stone-600"> · {c.motivo}</span>}
                </span>
                <form action={borrarCierre.bind(null, slug, c.id)}>
                  <button className="enlace text-red-700">Quitar</button>
                </form>
              </li>
            ))}
          </ul>
        )}
        <Formulario accion={anadirCierre.bind(null, slug)} limpiarAlTerminar className="mt-4 flex flex-wrap items-end gap-3">
          <Campo etiqueta="Desde">
            <input className="campo" type="date" name="fecha_inicio" required />
          </Campo>
          <Campo etiqueta="Hasta (opcional)">
            <input className="campo" type="date" name="fecha_fin" />
          </Campo>
          <Campo etiqueta="Motivo" className="min-w-48 flex-1">
            <input className="campo" name="motivo" placeholder="Feria de Abril" />
          </Campo>
          <BotonEnviar variante="secundario">Añadir cierre</BotonEnviar>
        </Formulario>
      </Seccion>
    </div>
  );
}
