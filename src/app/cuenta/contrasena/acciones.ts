"use server";

import { redirect } from "next/navigation";
import { requerirUsuario } from "@/lib/sesion";
import type { EstadoAccion } from "@/lib/errores";

export async function cambiarContrasena(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const contrasena = String(datos.get("contrasena") ?? "");
  const repetir = String(datos.get("repetir") ?? "");
  if (contrasena.length < 8) return { error: "La contraseña tiene que tener al menos 8 caracteres." };
  if (contrasena !== repetir) return { error: "Las dos contraseñas no coinciden." };

  const { supabase } = await requerirUsuario();
  const { error } = await supabase.auth.updateUser({ password: contrasena });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La contraseña nueva tiene que ser distinta de la anterior."
          : "No se ha podido guardar la contraseña. Prueba con otra más segura.",
    };
  }
  redirect("/");
}
