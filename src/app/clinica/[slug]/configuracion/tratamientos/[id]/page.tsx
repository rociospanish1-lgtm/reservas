import Link from "next/link";
import { notFound } from "next/navigation";
import { Titulo } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import type { Cabina, Profesional, Tratamiento } from "@/lib/tipos";
import { guardarTratamiento } from "../../acciones";
import { FormularioTratamiento } from "../formulario-tratamiento";

/** Edición de un tratamiento; con id = "nuevo" crea uno. */
export default async function PaginaTratamiento({ params }: PageProps<"/clinica/[slug]/configuracion/tratamientos/[id]">) {
  const { slug, id } = await params;
  const { supabase, clinica } = await requerirAdminPagina(slug);
  const esNuevo = id === "nuevo";

  let tratamiento: Tratamiento | null = null;
  if (!esNuevo) {
    const { data } = await supabase.from("tratamientos").select("*").eq("id", id).eq("clinica_id", clinica.id).maybeSingle<Tratamiento>();
    if (!data) notFound();
    tratamiento = data;
  }

  const [{ data: profesionales }, { data: cabinas }, { data: tp }, { data: tc }] = await Promise.all([
    supabase.from("profesionales").select("*").eq("clinica_id", clinica.id).order("orden").order("nombre"),
    supabase.from("cabinas").select("*").eq("clinica_id", clinica.id).order("nombre"),
    esNuevo
      ? Promise.resolve({ data: [] as { profesional_id: string }[] })
      : supabase.from("tratamiento_profesionales").select("profesional_id").eq("tratamiento_id", id),
    esNuevo
      ? Promise.resolve({ data: [] as { cabina_id: string }[] })
      : supabase.from("tratamiento_cabinas").select("cabina_id").eq("tratamiento_id", id),
  ]);

  return (
    <div className="space-y-6">
      <Link href={`/clinica/${slug}/configuracion/tratamientos`} className="enlace text-sm">
        ← Tratamientos
      </Link>
      <Titulo>{tratamiento ? tratamiento.nombre : "Nuevo tratamiento"}</Titulo>
      <FormularioTratamiento
        accion={guardarTratamiento.bind(null, slug, tratamiento?.id ?? null)}
        tratamiento={tratamiento}
        profesionales={(profesionales ?? []) as Profesional[]}
        cabinas={(cabinas ?? []) as Cabina[]}
        profesionalesMarcadas={new Set((tp ?? []).map((x) => x.profesional_id))}
        cabinasMarcadas={new Set((tc ?? []).map((x) => x.cabina_id))}
      />
    </div>
  );
}
