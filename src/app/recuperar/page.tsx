import Link from "next/link";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo } from "@/components/ui";
import { pedirCambioContrasena } from "../login/acciones";

export const metadata = { title: "Recuperar contraseña · Reservas" };

export default function PaginaRecuperar() {
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="tarjeta w-full max-w-sm">
        <h1 className="text-xl font-semibold">Recuperar contraseña</h1>
        <p className="mt-2 text-sm text-stone-600">Te enviaremos un enlace para elegir una contraseña nueva.</p>
        <Formulario accion={pedirCambioContrasena} className="mt-5 space-y-4">
          <Campo etiqueta="Email">
            <input className="campo" type="email" name="email" autoComplete="email" required />
          </Campo>
          <BotonEnviar className="w-full">Enviar enlace</BotonEnviar>
        </Formulario>
        <p className="mt-4 text-center text-sm">
          <Link href="/login" className="enlace">
            Volver a entrar
          </Link>
        </p>
      </div>
    </main>
  );
}
