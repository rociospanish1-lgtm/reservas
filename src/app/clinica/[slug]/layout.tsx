import Link from "next/link";
import { obtenerContextoClinica } from "@/lib/sesion";
import { Etiqueta } from "@/components/ui";
import { cerrarSesion } from "@/app/login/acciones";

export default async function LayoutClinica({ children, params }: LayoutProps<"/clinica/[slug]">) {
  const { slug } = await params;
  const { clinica, esAdmin, superadmin, usuario } = await obtenerContextoClinica(slug);
  const base = `/clinica/${slug}`;

  const enlaces = [
    { href: `${base}/agenda`, texto: "Agenda" },
    { href: `${base}/clientas`, texto: "Clientas" },
    ...(esAdmin ? [{ href: `${base}/configuracion`, texto: "Configuración" }] : []),
  ];

  return (
    <div className="flex min-h-full flex-1 flex-col">
      <header className="border-b border-stone-200 bg-white">
        <div className="mx-auto flex w-full max-w-7xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
          <Link href={`${base}/agenda`} className="flex items-center gap-2 font-semibold text-stone-900">
            {clinica.nombre}
            {clinica.es_demo && <Etiqueta color="marca">Demo</Etiqueta>}
            {!clinica.activa && <Etiqueta color="rojo">Desactivada</Etiqueta>}
          </Link>
          <nav className="flex gap-1">
            {enlaces.map((e) => (
              <Link key={e.href} href={e.href} className="rounded-lg px-3 py-1.5 text-sm text-stone-700 hover:bg-stone-100">
                {e.texto}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-4 text-sm text-stone-600">
            {superadmin && (
              <Link href="/admin" className="enlace">
                Todas las clínicas
              </Link>
            )}
            <span className="hidden sm:inline">{usuario.email}</span>
            <form action={cerrarSesion}>
              <button className="enlace">Salir</button>
            </form>
          </div>
        </div>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6">{children}</main>
    </div>
  );
}
