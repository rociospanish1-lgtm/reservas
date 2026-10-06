import Link from "next/link";
import { Etiqueta, Seccion, Titulo, Vacio } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import { precioTexto } from "@/lib/formato";
import type { Tratamiento } from "@/lib/tipos";

export default async function PaginaTratamientos({ params }: PageProps<"/clinica/[slug]/configuracion/tratamientos">) {
  const { slug } = await params;
  const { supabase, clinica } = await requerirAdminPagina(slug);
  const { data } = await supabase.from("tratamientos").select("*").eq("clinica_id", clinica.id).order("orden").order("nombre");
  const tratamientos = (data ?? []) as Tratamiento[];
  const base = `/clinica/${slug}/configuracion/tratamientos`;

  return (
    <div className="space-y-6">
      <Titulo
        accion={
          <Link href={`${base}/nuevo`} className="boton">
            Nuevo tratamiento
          </Link>
        }
      >
        Tratamientos
      </Titulo>
      <Seccion titulo="Carta de tratamientos" descripcion="El asistente de WhatsApp solo contesta con la información que pongas aquí.">
        {tratamientos.length === 0 ? (
          <Vacio>Todavía no hay tratamientos.</Vacio>
        ) : (
          <ul className="divide-y divide-stone-100">
            {tratamientos.map((t) => (
              <li key={t.id}>
                <Link href={`${base}/${t.id}`} className="flex flex-wrap items-center gap-3 py-3 hover:bg-stone-50">
                  <span className="font-medium">{t.nombre}</span>
                  <span className="text-sm text-stone-600">
                    {t.duracion_min} min · {precioTexto(t)}
                  </span>
                  {!t.activo && <Etiqueta>Inactivo</Etiqueta>}
                  {t.activo && !t.reservable_online && <Etiqueta color="ambar">Solo en clínica</Etiqueta>}
                  <span className="ml-auto text-sm text-marca-700">Editar →</span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </Seccion>
    </div>
  );
}
