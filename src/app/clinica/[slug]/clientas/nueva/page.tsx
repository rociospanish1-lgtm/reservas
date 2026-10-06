import Link from "next/link";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo, Titulo } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import { crearClienta } from "../acciones";

export const metadata = { title: "Nueva clienta" };

export default async function PaginaNuevaClienta({ params }: PageProps<"/clinica/[slug]/clientas/nueva">) {
  const { slug } = await params;
  await requerirAdminPagina(slug);
  return (
    <div className="mx-auto max-w-xl space-y-6">
      <Link href={`/clinica/${slug}/clientas`} className="enlace text-sm">
        ← Clientas
      </Link>
      <Titulo>Nueva clienta</Titulo>
      <Formulario accion={crearClienta.bind(null, slug)} className="tarjeta space-y-4">
        <Campo etiqueta="Nombre y apellidos">
          <input className="campo" name="nombre" required />
        </Campo>
        <Campo etiqueta="Teléfono" ayuda="Es lo que usa el asistente de WhatsApp para reconocerla.">
          <input className="campo" name="telefono" inputMode="tel" placeholder="612 345 678" />
        </Campo>
        <Campo etiqueta="Email">
          <input className="campo" type="email" name="email" />
        </Campo>
        <Campo etiqueta="Notas para el asistente (sin datos de salud)" ayuda="Preferencias: horario, profesional favorita… El asistente las tiene en cuenta pero nunca se las lee a la clienta.">
          <textarea className="campo" rows={2} name="notas_asistente" />
        </Campo>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="consentimiento" className="mt-0.5" />
          La clienta ha aceptado la política de privacidad de la clínica.
        </label>
        <BotonEnviar>Crear ficha</BotonEnviar>
      </Formulario>
    </div>
  );
}
