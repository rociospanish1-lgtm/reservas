import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { crearClienteServidor } from "@/lib/supabase/servidor";

/**
 * Enlace de los emails de invitación y de cambio de contraseña.
 * Valida el código del enlace, inicia la sesión y lleva a la página indicada.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const siguiente = searchParams.get("next") ?? "/";
  // Solo rutas internas, para que nadie use el enlace para redirigir a otra web
  const destino = siguiente.startsWith("/") && !siguiente.startsWith("//") ? siguiente : "/";

  if (tokenHash && tipo) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
  }

  const url = new URL("/login", request.url);
  url.searchParams.set("aviso", "enlace");
  return NextResponse.redirect(url);
}
