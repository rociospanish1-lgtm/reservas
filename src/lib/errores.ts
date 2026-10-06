import { unstable_rethrow } from "next/navigation";

/**
 * Traduce los errores de la base de datos a mensajes claros para la clínica.
 */
type ErrorBD = { code?: string; message?: string; hint?: string | null } | null | undefined;

// Errores lanzados a propósito por nuestras funciones (ya vienen en español)
const CODIGOS_PROPIOS = new Set(["P0001", "P0002", "22023"]);

export function mensajeDeError(error: ErrorBD, porDefecto = "Ha ocurrido un error. Inténtalo de nuevo."): string {
  if (!error) return porDefecto;
  const codigo = error.code ?? "";
  const mensaje = error.message ?? "";

  if (CODIGOS_PROPIOS.has(codigo)) return mensaje;
  if (codigo === "42501") {
    // Mensaje propio en español, o el de la seguridad por filas (en inglés)
    return mensaje.startsWith("new row violates") || mensaje.startsWith("permission denied")
      ? "No tienes permiso para hacer esto."
      : mensaje;
  }
  if (codigo === "23P01") return "Esa hora se cruza con otra cita de la profesional o de la cabina.";
  if (codigo === "23505") {
    if (mensaje.includes("clientas_telefono_unico")) return "Ya hay una clienta con ese teléfono.";
    if (mensaje.includes("slug")) return "Ya existe una clínica con esa dirección web.";
    return "Ese dato ya existe.";
  }
  if (codigo === "23503") return "No se puede hacer porque hay otros datos que dependen de este.";
  if (codigo === "23514") return "Algún dato no es válido. Revisa el formulario.";

  console.error("Error de base de datos sin traducir:", error);
  return porDefecto;
}

/** Estado que devuelven las acciones de los formularios */
export type EstadoAccion = { ok?: boolean; error?: string; mensaje?: string } | null;

export const ESTADO_INICIAL: EstadoAccion = null;

export function errorAccion(e: unknown): EstadoAccion {
  // redirect() y notFound() de Next.js se lanzan como errores: hay que dejarlos pasar
  unstable_rethrow(e);
  if (e instanceof ErrorUsuario) return { error: e.message };
  console.error(e);
  return { error: "Ha ocurrido un error. Inténtalo de nuevo." };
}

/** Error con un mensaje pensado para mostrarse tal cual a la usuaria */
export class ErrorUsuario extends Error {}
