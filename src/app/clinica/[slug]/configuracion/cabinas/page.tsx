import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo, Seccion, Titulo, Vacio } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import type { Cabina } from "@/lib/tipos";
import { crearCabina, guardarCabina } from "../acciones";

export default async function PaginaCabinas({ params }: PageProps<"/clinica/[slug]/configuracion/cabinas">) {
  const { slug } = await params;
  const { supabase, clinica } = await requerirAdminPagina(slug);
  const { data } = await supabase.from("cabinas").select("*").eq("clinica_id", clinica.id).order("nombre");
  const cabinas = (data ?? []) as Cabina[];

  return (
    <div className="space-y-6">
      <Titulo>Cabinas y salas</Titulo>
      <Seccion
        titulo="Cabinas"
        descripcion="En cada tratamiento puedes indicar en qué cabinas se hace. Nunca habrá dos citas a la vez en la misma cabina."
      >
        {cabinas.length === 0 ? (
          <Vacio>No hay cabinas. Si tus tratamientos no necesitan una sala concreta, no hace falta crearlas.</Vacio>
        ) : (
          <ul className="space-y-2">
            {cabinas.map((c) => (
              <li key={c.id}>
                <Formulario accion={guardarCabina.bind(null, slug, c.id)} className="flex flex-wrap items-center gap-3">
                  <input className="campo max-w-xs" name="nombre" defaultValue={c.nombre} required aria-label="Nombre de la cabina" />
                  <label className="flex items-center gap-2 text-sm">
                    <input type="checkbox" name="activa" defaultChecked={c.activa} /> Activa
                  </label>
                  <BotonEnviar variante="secundario">Guardar</BotonEnviar>
                </Formulario>
              </li>
            ))}
          </ul>
        )}
        <Formulario accion={crearCabina.bind(null, slug)} limpiarAlTerminar className="mt-4 flex flex-wrap items-end gap-3">
          <Campo etiqueta="Nueva cabina" className="min-w-48 flex-1">
            <input className="campo" name="nombre" required placeholder="Cabina 3" />
          </Campo>
          <BotonEnviar variante="secundario">Añadir</BotonEnviar>
        </Formulario>
      </Seccion>
    </div>
  );
}
