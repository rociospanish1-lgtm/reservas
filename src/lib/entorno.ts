/**
 * Variables de entorno. Las claves nunca se escriben en el código:
 * en tu ordenador van en `.env.local` y en producción en la configuración de Vercel.
 */
function obligatoria(nombre: string, valor: string | undefined): string {
  if (!valor) {
    throw new Error(`Falta la variable de entorno ${nombre}. Revisa tu archivo .env.local (ver .env.example).`);
  }
  return valor;
}

export const entorno = {
  // Las NEXT_PUBLIC_* se tienen que leer de forma literal para que Next.js las incluya.
  supabaseUrl: () => obligatoria("NEXT_PUBLIC_SUPABASE_URL", process.env.NEXT_PUBLIC_SUPABASE_URL),
  supabaseClavePublica: () =>
    obligatoria("NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY", process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY),
  urlSitio: () => process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000",
};
