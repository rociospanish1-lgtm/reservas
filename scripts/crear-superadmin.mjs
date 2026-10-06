// Da permisos de superadmin a una persona (tú). Si no tiene cuenta, le llega
// un email de invitación para crear su contraseña.
// Uso: npm run superadmin -- tu@email.com
// Usa las claves de .env.local; para producción, pon ahí temporalmente las de
// tu proyecto de Supabase en la nube (y bórralas después).
import { createClient } from "@supabase/supabase-js";

process.loadEnvFile(".env.local");
const email = (process.argv[2] ?? "").trim().toLowerCase();
if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
  console.error("✗ Indica un email. Ejemplo: npm run superadmin -- tu@email.com");
  process.exit(1);
}

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const sitio = process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000";
const supabase = createClient(url, process.env.SUPABASE_SECRET_KEY, {
  auth: { persistSession: false, autoRefreshToken: false },
});

let { data: id } = await supabase.rpc("usuario_id_por_email", { p_email: email });
if (!id) {
  const { data, error } = await supabase.auth.admin.inviteUserByEmail(email, { redirectTo: `${sitio}/cuenta/contrasena` });
  if (error) {
    console.error("✗ No se ha podido invitar:", error.message);
    process.exit(1);
  }
  id = data.user.id;
  console.log(`✓ Invitación enviada a ${email}.`);
}
const { error } = await supabase.from("superadmins").upsert({ user_id: id });
if (error) {
  console.error("✗ No se ha podido guardar:", error.message);
  process.exit(1);
}
console.log(`✓ ${email} es superadmin en ${url}.`);
