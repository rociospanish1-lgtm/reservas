// Crea (o actualiza) el archivo .env.local con las claves de la base de datos
// local de Supabase. Uso: npm run entorno:local
// Solo sirve para tu ordenador: en producción las claves se ponen en Vercel.
import { execSync } from "node:child_process";
import { existsSync, readFileSync, writeFileSync } from "node:fs";

let salida;
try {
  salida = execSync("npx supabase status -o env", { encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
} catch {
  console.error("✗ La base de datos local no está en marcha. Abre Docker Desktop y ejecuta: npx supabase start");
  process.exit(1);
}

const valores = {};
for (const linea of salida.split(/\r?\n/)) {
  const m = linea.match(/^([A-Z_]+)="?(.*?)"?$/);
  if (m) valores[m[1]] = m[2];
}

const nuevas = {
  NEXT_PUBLIC_SUPABASE_URL: valores.API_URL,
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: valores.PUBLISHABLE_KEY || valores.ANON_KEY,
  SUPABASE_SECRET_KEY: valores.SECRET_KEY || valores.SERVICE_ROLE_KEY,
  NEXT_PUBLIC_SITE_URL: "http://localhost:3000",
};

// Partimos del archivo de ejemplo o del .env.local que ya exista, y sustituimos esas claves
const base = existsSync(".env.local") ? readFileSync(".env.local", "utf8") : readFileSync(".env.example", "utf8");
let resultado = base;
for (const [clave, valor] of Object.entries(nuevas)) {
  const linea = `${clave}=${valor}`;
  resultado = new RegExp(`^${clave}=.*$`, "m").test(resultado)
    ? resultado.replace(new RegExp(`^${clave}=.*$`, "m"), linea)
    : `${resultado.trimEnd()}\n${linea}\n`;
}
writeFileSync(".env.local", resultado);
console.log("✓ .env.local preparado con las claves de la base de datos local.");
