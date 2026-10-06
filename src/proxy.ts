import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

// Rutas que necesitan sesión iniciada
const PRIVADAS = ["/admin", "/clinica", "/cuenta"];

/**
 * Se ejecuta antes de cada página: refresca la sesión de Supabase (cookies)
 * y manda al login a quien intente entrar en el panel sin sesión.
 */
export async function proxy(request: NextRequest) {
  let respuesta = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesNuevas, cabeceras) {
          for (const { name, value } of cookiesNuevas) request.cookies.set(name, value);
          respuesta = NextResponse.next({ request });
          for (const { name, value, options } of cookiesNuevas) {
            respuesta.cookies.set(name, value, options);
          }
          for (const [clave, valor] of Object.entries(cabeceras ?? {})) {
            respuesta.headers.set(clave, valor);
          }
        },
      },
    },
  );

  const { data } = await supabase.auth.getClaims();
  const conSesion = Boolean(data?.claims);
  const ruta = request.nextUrl.pathname;

  if (!conSesion && PRIVADAS.some((p) => ruta === p || ruta.startsWith(`${p}/`))) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    url.searchParams.set("volver", ruta);
    return NextResponse.redirect(url);
  }

  return respuesta;
}

export const config = {
  matcher: [
    // Todo menos archivos estáticos e imágenes
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
