import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { entorno } from "@/lib/entorno";

/**
 * Cliente de Supabase con la sesión del usuario que está usando el panel.
 * Todo lo que lee o escribe pasa por la seguridad por filas (RLS).
 */
export async function crearClienteServidor() {
  const almacen = await cookies();
  return createServerClient(entorno.supabaseUrl(), entorno.supabaseClavePublica(), {
    cookies: {
      getAll() {
        return almacen.getAll();
      },
      setAll(cookiesNuevas) {
        try {
          for (const { name, value, options } of cookiesNuevas) {
            almacen.set(name, value, options);
          }
        } catch {
          // Desde un Server Component no se pueden escribir cookies; el proxy ya
          // refresca la sesión en cada petición, así que se puede ignorar.
        }
      },
    },
  });
}
