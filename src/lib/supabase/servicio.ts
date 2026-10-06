import "server-only";
import { createClient } from "@supabase/supabase-js";
import { entorno } from "@/lib/entorno";

/**
 * Cliente con la clave secreta de Supabase: se salta la seguridad por filas.
 * Solo se usa en el servidor y para tareas concretas (invitar usuarios,
 * reservas desde la web o el asistente). Nunca se envía al navegador.
 */
export function crearClienteServicio() {
  const clave = process.env.SUPABASE_SECRET_KEY;
  if (!clave) {
    throw new Error("Falta la variable de entorno SUPABASE_SECRET_KEY. Revisa tu archivo .env.local.");
  }
  return createClient(entorno.supabaseUrl(), clave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
