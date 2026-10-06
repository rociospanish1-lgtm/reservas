import Link from "next/link";
import { redirect } from "next/navigation";
import { esSuperadmin, obtenerUsuario } from "@/lib/sesion";
import { cerrarSesion } from "./login/acciones";

/**
 * Página de entrada: lleva a cada persona a su sitio.
 *   - sin sesión -> login
 *   - superadmin -> panel de clínicas
 *   - una sola clínica -> su agenda
 *   - varias clínicas -> elegir
 */
export default async function Inicio() {
  const { supabase, usuario } = await obtenerUsuario();
  if (!usuario) redirect("/login");
  if (await esSuperadmin()) redirect("/admin");

  const { data } = await supabase
    .from("miembros")
    .select("rol, clinicas!inner(nombre, slug, activa)")
    .eq("user_id", usuario.id);
  const clinicas = (data ?? [])
    .map((m) => m.clinicas as unknown as { nombre: string; slug: string; activa: boolean })
    .filter((c) => c.activa);

  if (clinicas.length === 1) redirect(`/clinica/${clinicas[0].slug}/agenda`);

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="tarjeta w-full max-w-md">
        {clinicas.length === 0 ? (
          <>
            <h1 className="text-xl font-semibold">No tienes ninguna clínica activa</h1>
            <p className="mt-2 text-sm text-stone-600">
              Si crees que es un error, habla con la persona que te invitó.
            </p>
          </>
        ) : (
          <>
            <h1 className="text-xl font-semibold">Elige una clínica</h1>
            <ul className="mt-4 space-y-2">
              {clinicas.map((c) => (
                <li key={c.slug}>
                  <Link href={`/clinica/${c.slug}/agenda`} className="boton-secundario w-full">
                    {c.nombre}
                  </Link>
                </li>
              ))}
            </ul>
          </>
        )}
        <form action={cerrarSesion} className="mt-6">
          <button className="enlace text-sm">Cerrar sesión</button>
        </form>
      </div>
    </main>
  );
}
