"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/servidor";
import { entorno } from "@/lib/entorno";
import type { EstadoAccion } from "@/lib/errores";

export async function iniciarSesion(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const email = String(datos.get("email") ?? "").trim();
  const contrasena = String(datos.get("contrasena") ?? "");
  const volver = String(datos.get("volver") ?? "/");
  if (!email || !contrasena) return { error: "Escribe tu email y tu contraseña." };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email, password: contrasena });
  if (error) return { error: "El email o la contraseña no son correctos." };

  redirect(volver.startsWith("/") && !volver.startsWith("//") ? volver : "/");
}

export async function pedirCambioContrasena(_: EstadoAccion, datos: FormData): Promise<EstadoAccion> {
  const email = String(datos.get("email") ?? "").trim();
  if (!email) return { error: "Escribe tu email." };

  const supabase = await crearClienteServidor();
  await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${entorno.urlSitio()}/cuenta/contrasena` });
  // Mismo mensaje exista o no la cuenta, para no revelar qué emails están dados de alta
  return { ok: true, mensaje: "Si ese email tiene cuenta, te hemos enviado un enlace para cambiar la contraseña." };
}

export async function cerrarSesion() {
  const supabase = await crearClienteServidor();
  await supabase.auth.signOut();
  redirect("/login");
}
