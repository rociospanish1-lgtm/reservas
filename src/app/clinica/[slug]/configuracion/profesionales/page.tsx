import Link from "next/link";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo, Etiqueta, Seccion, Titulo, Vacio } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import type { Profesional } from "@/lib/tipos";
import { crearProfesional } from "../acciones";

export default async function PaginaProfesionales({ params }: PageProps<"/clinica/[slug]/configuracion/profesionales">) {
  const { slug } = await params;
  const { supabase, clinica } = await requerirAdminPagina(slug);
  const { data } = await supabase.from("profesionales").select("*").eq("clinica_id", clinica.id).order("orden").order("nombre");
  const profesionales = (data ?? []) as Profesional[];

  return (
    <div className="space-y-6">
      <Titulo>Profesionales</Titulo>
      <Seccion titulo="Equipo de la agenda">
        {profesionales.length === 0 ? (
          <Vacio>Añade a la primera profesional.</Vacio>
        ) : (
          <ul className="divide-y divide-stone-100">
            {profesionales.map((p) => (
              <li key={p.id}>
                <Link href={`/clinica/${slug}/configuracion/profesionales/${p.id}`} className="flex items-center gap-3 py-3 hover:bg-stone-50">
                  <span className="h-4 w-4 rounded-full" style={{ backgroundColor: p.color }} />
                  <span className="font-medium">{p.nombre}</span>
                  {!p.activa && <Etiqueta>Inactiva</Etiqueta>}
                  <span className="ml-auto text-sm text-marca-700">Horario y tratamientos →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
        <Formulario accion={crearProfesional.bind(null, slug)} limpiarAlTerminar className="mt-4 flex flex-wrap items-end gap-3">
          <Campo etiqueta="Nombre" className="min-w-48 flex-1">
            <input className="campo" name="nombre" required />
          </Campo>
          <Campo etiqueta="Color en la agenda">
            <input className="h-10 w-16 cursor-pointer rounded-lg border border-stone-300" type="color" name="color" defaultValue="#c084fc" />
          </Campo>
          <BotonEnviar variante="secundario">Añadir profesional</BotonEnviar>
        </Formulario>
      </Seccion>
    </div>
  );
}
