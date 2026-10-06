import Link from "next/link";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo } from "@/components/ui";
import { iniciarSesion } from "./acciones";

export const metadata = { title: "Entrar · Reservas" };

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const volver = typeof params.volver === "string" ? params.volver : "/";
  const enlaceCaducado = params.aviso === "enlace";

  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="tarjeta w-full max-w-sm">
        <h1 className="text-xl font-semibold">Entrar en tu agenda</h1>
        {enlaceCaducado && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-800">
            El enlace no es válido o ha caducado. Pide uno nuevo.
          </p>
        )}
        <Formulario accion={iniciarSesion} className="mt-5 space-y-4">
          <input type="hidden" name="volver" value={volver} />
          <Campo etiqueta="Email">
            <input className="campo" type="email" name="email" autoComplete="email" required />
          </Campo>
          <Campo etiqueta="Contraseña">
            <input className="campo" type="password" name="contrasena" autoComplete="current-password" required />
          </Campo>
          <BotonEnviar className="w-full">Entrar</BotonEnviar>
        </Formulario>
        <p className="mt-4 text-center text-sm">
          <Link href="/recuperar" className="enlace">
            ¿Has olvidado tu contraseña?
          </Link>
        </p>
      </div>
    </main>
  );
}
