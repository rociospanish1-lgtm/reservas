// Crea los usuarios de la Clínica Demo Sevilla para enseñarla y probarla.
// Uso: npm run demo:usuarios
// SOLO funciona contra la base de datos local (nunca en producción).
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const clave = process.env.SUPABASE_SECRET_KEY;
const contrasena = process.env.DEMO_CONTRASENA;

if (!/^http:\/\/(127\.0\.0\.1|localhost)/.test(url ?? "")) {
  console.error("✗ Este script solo se puede usar con la base de datos local.");
  process.exit(1);
}
if (!clave || !contrasena) {
  console.error("✗ Faltan SUPABASE_SECRET_KEY o DEMO_CONTRASENA en .env.local (ejecuta antes: npm run entorno:local).");
  process.exit(1);
}

const supabase = createClient(url, clave, { auth: { persistSession: false, autoRefreshToken: false } });
const CLINICA = "00000000-0000-4000-8000-000000000001";
const usuarios = [
  { email: "superadmin@demo.local", superadmin: true },
  { email: "admin@demo.local", rol: "admin" },
  { email: "lucia@demo.local", rol: "profesional", profesional: "00000000-0000-4000-8000-000000000101" },
  { email: "carmen@demo.local", rol: "profesional", profesional: "00000000-0000-4000-8000-000000000102" },
  { email: "marta@demo.local", rol: "profesional", profesional: "00000000-0000-4000-8000-000000000103" },
];

for (const u of usuarios) {
  let id;
  const { data, error } = await supabase.auth.admin.createUser({ email: u.email, password: contrasena, email_confirm: true });
  if (error) {
    const { data: existente } = await supabase.rpc("usuario_id_por_email", { p_email: u.email });
    if (!existente) throw error;
    id = existente;
    await supabase.auth.admin.updateUserById(id, { password: contrasena });
  } else {
    id = data.user.id;
  }
  if (u.superadmin) {
    await supabase.from("superadmins").upsert({ user_id: id });
  } else {
    const { error: e } = await supabase
      .from("miembros")
      .upsert({ user_id: id, clinica_id: CLINICA, rol: u.rol, profesional_id: u.profesional ?? null }, { onConflict: "user_id,clinica_id" });
    if (e) throw e;
  }
  console.log(`✓ ${u.email}`);
}
console.log("\nUsuarios de la demo listos. La contraseña es la de DEMO_CONTRASENA en tu .env.local.");
