import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo } from "@/components/ui";
import { requerirUsuario } from "@/lib/sesion";
import { cambiarContrasena } from "./acciones";

export const metadata = { title: "Tu contraseña · Reservas" };

export default async function PaginaContrasena() {
  const { usuario } = await requerirUsuario();
  return (
    <main className="flex flex-1 items-center justify-center p-6">
      <div className="tarjeta w-full max-w-sm">
        <h1 className="text-xl font-semibold">Elige tu contraseña</h1>
        <p className="mt-2 text-sm text-stone-600">Cuenta: {usuario.email}</p>
        <Formulario accion={cambiarContrasena} className="mt-5 space-y-4">
          <Campo etiqueta="Contraseña nueva" ayuda="Mínimo 8 caracteres.">
            <input className="campo" type="password" name="contrasena" minLength={8} autoComplete="new-password" required />
          </Campo>
          <Campo etiqueta="Repite la contraseña">
            <input className="campo" type="password" name="repetir" minLength={8} autoComplete="new-password" required />
          </Campo>
          <BotonEnviar className="w-full">Guardar y entrar</BotonEnviar>
        </Formulario>
      </div>
    </main>
  );
}
