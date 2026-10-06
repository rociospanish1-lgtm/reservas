import Link from "next/link";
import { requerirAdminPagina } from "@/lib/sesion";

export default async function LayoutConfiguracion({ children, params }: LayoutProps<"/clinica/[slug]/configuracion">) {
  const { slug } = await params;
  await requerirAdminPagina(slug);
  const base = `/clinica/${slug}/configuracion`;
  const secciones = [
    { href: base, texto: "Clínica y horario" },
    { href: `${base}/profesionales`, texto: "Profesionales" },
    { href: `${base}/cabinas`, texto: "Cabinas" },
    { href: `${base}/tratamientos`, texto: "Tratamientos" },
    { href: `${base}/equipo`, texto: "Equipo y accesos" },
  ];
  return (
    <div className="grid gap-6 lg:grid-cols-[13rem_1fr]">
      <nav className="flex gap-1 overflow-x-auto lg:flex-col">
        {secciones.map((s) => (
          <Link key={s.href} href={s.href} className="whitespace-nowrap rounded-lg px-3 py-2 text-sm text-stone-700 hover:bg-white">
            {s.texto}
          </Link>
        ))}
      </nav>
      <div className="min-w-0">{children}</div>
    </div>
  );
}
