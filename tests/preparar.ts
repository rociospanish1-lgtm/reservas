import { execSync } from "node:child_process";
import type { TestProject } from "vitest/node";

/**
 * Antes de las pruebas: lee las claves de la base de datos local de Supabase
 * (la que corre en Docker) para que las pruebas se conecten a ella.
 * Nunca se conectan a la base de datos real de producción.
 */
export default function preparar(project: TestProject) {
  let salida: string;
  try {
    salida = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
  } catch {
    throw new Error(
      "No encuentro la base de datos local. Abre Docker Desktop y ejecuta `npx supabase start` antes de las pruebas.",
    );
  }
  const valores: Record<string, string> = {};
  for (const linea of salida.split(/\r?\n/)) {
    const m = linea.match(/^([A-Z_]+)="?(.*?)"?$/);
    if (m) valores[m[1]] = m[2];
  }
  const url = valores.API_URL;
  const publica = valores.PUBLISHABLE_KEY || valores.ANON_KEY;
  const secreta = valores.SECRET_KEY || valores.SERVICE_ROLE_KEY;
  if (!url || !publica || !secreta) throw new Error("No he podido leer las claves de `npx supabase status`.");
  if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url)) {
    throw new Error("Las pruebas solo se ejecutan contra la base de datos local.");
  }
  project.provide("supabaseUrl", url);
  project.provide("clavePublica", publica);
  project.provide("claveSecreta", secreta);
}

declare module "vitest" {
  export interface ProvidedContext {
    supabaseUrl: string;
    clavePublica: string;
    claveSecreta: string;
  }
}
