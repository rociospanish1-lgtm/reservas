import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo, Etiqueta, Seccion, Titulo, Vacio } from "@/components/ui";
import { requerirAdminPagina } from "@/lib/sesion";
import type { Profesional } from "@/lib/tipos";
import { invitarMiembro, quitarMiembro } from "../acciones";

interface MiembroEquipo {
  miembro_id: string;
  user_id: string;
  email: string;
  rol: "admin" | "profesional";
  profesional_id: string | null;
  ha_entrado: boolean;
}

export default async function PaginaEquipo({ params }: PageProps<"/clinica/[slug]/configuracion/equipo">) {
  const { slug } = await params;
  const { supabase, clinica, usuario } = await requerirAdminPagina(slug);
  const [{ data: equipo }, { data: profesionales }] = await Promise.all([
    supabase.rpc("listar_equipo", { p_clinica_id: clinica.id }),
    supabase.from("profesionales").select("*").eq("clinica_id", clinica.id).eq("activa", true).order("nombre"),
  ]);
  const miembros = (equipo ?? []) as MiembroEquipo[];
  const nombreProfesional = new Map(((profesionales ?? []) as Profesional[]).map((p) => [p.id, p.nombre]));

  return (
    <div className="space-y-6">
      <Titulo>Equipo y accesos</Titulo>
      <Seccion
        titulo="Personas con acceso al panel"
        descripcion="Admin: gestiona toda la clínica. Profesional: solo ve su agenda y las clientas que atiende."
      >
        {miembros.length === 0 ? (
          <Vacio>Nadie tiene acceso todavía.</Vacio>
        ) : (
          <ul className="divide-y divide-stone-100">
            {miembros.map((m) => (
              <li key={m.miembro_id} className="flex flex-wrap items-center gap-3 py-3 text-sm">
                <span className="font-medium">{m.email}</span>
                <Etiqueta color={m.rol === "admin" ? "marca" : "stone"}>
                  {m.rol === "admin" ? "Admin" : `Profesional · ${nombreProfesional.get(m.profesional_id ?? "") ?? "—"}`}
                </Etiqueta>
                {!m.ha_entrado && <Etiqueta color="ambar">Invitación pendiente</Etiqueta>}
                {m.user_id !== usuario.id && (
                  <form action={quitarMiembro.bind(null, slug, m.miembro_id)} className="ml-auto">
                    <button className="enlace text-red-700">Quitar acceso</button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </Seccion>

      <Seccion titulo="Invitar a alguien" descripcion="Le llegará un email para crear su contraseña.">
        <Formulario accion={invitarMiembro.bind(null, slug)} limpiarAlTerminar className="grid gap-4 sm:grid-cols-3 sm:items-end">
          <Campo etiqueta="Email">
            <input className="campo" type="email" name="email" required />
          </Campo>
          <Campo etiqueta="Tipo de acceso">
            <select className="campo" name="rol" defaultValue="profesional">
              <option value="profesional">Profesional</option>
              <option value="admin">Admin</option>
            </select>
          </Campo>
          <Campo etiqueta="Profesional de la agenda" ayuda="Solo si el acceso es de profesional.">
            <select className="campo" name="profesional_id" defaultValue="">
              <option value="">—</option>
              {((profesionales ?? []) as Profesional[]).map((p) => (
                <option key={p.id} value={p.id}>
                  {p.nombre}
                </option>
              ))}
            </select>
          </Campo>
          <div className="sm:col-span-3">
            <BotonEnviar>Enviar invitación</BotonEnviar>
          </div>
        </Formulario>
      </Seccion>
    </div>
  );
}
