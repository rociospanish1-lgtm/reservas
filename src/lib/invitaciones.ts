import "server-only";
import { crearClienteServicio } from "@/lib/supabase/servicio";
import { entorno } from "@/lib/entorno";
import { ErrorUsuario } from "@/lib/errores";
import type { Rol } from "@/lib/tipos";

const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Da acceso a una persona a una clínica.
 * Si no tiene cuenta, le llega un email para crear su contraseña.
 * Si ya tiene cuenta (por ejemplo, trabaja en dos clínicas), se le añade sin email.
 *
 * Quien llama a esta función tiene que haber comprobado antes los permisos.
 */
export async function invitarAClinica(opciones: {
  clinicaId: string;
  email: string;
  rol: Rol;
  profesionalId?: string | null;
}): Promise<"invitada" | "añadida"> {
  const email = opciones.email.trim().toLowerCase();
  if (!EMAIL_VALIDO.test(email)) throw new ErrorUsuario("El email no es válido.");
  if (opciones.rol === "profesional" && !opciones.profesionalId) {
    throw new ErrorUsuario("Elige a qué profesional de la agenda corresponde este usuario.");
  }

  const servicio = crearClienteServicio();
  let userId: string | null = null;
  let resultado: "invitada" | "añadida" = "invitada";

  const { data, error } = await servicio.auth.admin.inviteUserByEmail(email, {
    redirectTo: `${entorno.urlSitio()}/cuenta/contrasena`,
  });
  if (error) {
    const { data: existente } = await servicio.rpc("usuario_id_por_email", { p_email: email });
    if (!existente) {
      console.error("Error al invitar:", error);
      throw new ErrorUsuario("No se ha podido enviar la invitación. Inténtalo de nuevo en unos minutos.");
    }
    userId = existente as string;
    resultado = "añadida";
  } else {
    userId = data.user.id;
  }

  const { error: errorMiembro } = await servicio.from("miembros").upsert(
    {
      user_id: userId,
      clinica_id: opciones.clinicaId,
      rol: opciones.rol,
      profesional_id: opciones.rol === "profesional" ? opciones.profesionalId : null,
    },
    { onConflict: "user_id,clinica_id" },
  );
  if (errorMiembro) {
    console.error("Error al guardar el miembro:", errorMiembro);
    throw new ErrorUsuario("No se ha podido dar acceso a esa persona.");
  }
  return resultado;
}
