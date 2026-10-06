import Link from "next/link";
import { redirect } from "next/navigation";
import { Formulario, BotonEnviar } from "@/components/formulario";
import { Campo, Etiqueta, Seccion, Titulo, Vacio } from "@/components/ui";
import { esSuperadmin, requerirUsuario } from "@/lib/sesion";
import type { Clinica } from "@/lib/tipos";
import { cerrarSesion } from "../login/acciones";
import { cambiarEstadoClinica, crearClinica, invitarAdmin } from "./acciones";

export const metadata = { title: "Clínicas · Superadmin" };

export default async function PaginaAdmin() {
  const { supabase, usuario } = await requerirUsuario();
  if (!(await esSuperadmin())) redirect("/");

  const { data } = await supabase.from("clinicas").select("*").order("nombre");
  const clinicas = (data ?? []) as Clinica[];
  const { data: miembros } = await supabase.from("miembros").select("clinica_id, rol");
  const cuenta = (id: string, rol: string) => (miembros ?? []).filter((m) => m.clinica_id === id && m.rol === rol).length;

  return (
    <div className="mx-auto w-full max-w-5xl p-6">
      <header className="mb-8 flex items-center justify-between">
        <p className="text-sm text-stone-600">
          Superadmin · <span className="font-medium">{usuario.email}</span>
        </p>
        <form action={cerrarSesion}>
          <button className="enlace text-sm">Cerrar sesión</button>
        </form>
      </header>

      <Titulo>Clínicas</Titulo>

      <div className="space-y-6">
        <Seccion titulo="Dar de alta una clínica" descripcion="Si pones el email de su responsable, le llegará una invitación para crear su contraseña.">
          <Formulario accion={crearClinica} limpiarAlTerminar className="grid gap-4 sm:grid-cols-2">
            <Campo etiqueta="Nombre de la clínica">
              <input className="campo" name="nombre" required placeholder="Clínica Bella Piel" />
            </Campo>
            <Campo etiqueta="Dirección web (opcional)" ayuda="Si lo dejas vacío se crea a partir del nombre.">
              <input className="campo" name="slug" placeholder="bella-piel-malaga" pattern="[a-z0-9\-]*" />
            </Campo>
            <Campo etiqueta="Zona horaria">
              <select className="campo" name="zona_horaria" defaultValue="Europe/Madrid">
                <option value="Europe/Madrid">Península y Baleares</option>
                <option value="Atlantic/Canary">Canarias</option>
              </select>
            </Campo>
            <Campo etiqueta="Email de la persona responsable (opcional)">
              <input className="campo" type="email" name="email_admin" placeholder="duena@clinica.es" />
            </Campo>
            <div className="sm:col-span-2">
              <BotonEnviar>Crear clínica</BotonEnviar>
            </div>
          </Formulario>
        </Seccion>

        {clinicas.length === 0 ? (
          <Vacio>Todavía no hay clínicas.</Vacio>
        ) : (
          <ul className="space-y-4">
            {clinicas.map((c) => (
              <li key={c.id} className="tarjeta">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div>
                    <p className="flex items-center gap-2 text-lg font-semibold">
                      {c.nombre}
                      {c.activa ? <Etiqueta color="verde">Activa</Etiqueta> : <Etiqueta color="rojo">Desactivada</Etiqueta>}
                      {c.es_demo && <Etiqueta color="marca">Demo</Etiqueta>}
                    </p>
                    <p className="text-sm text-stone-600">
                      /clinica/{c.slug} · {cuenta(c.id, "admin")} admin · {cuenta(c.id, "profesional")} profesionales con acceso
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Link href={`/clinica/${c.slug}/agenda`} className="boton-secundario">
                      Abrir panel
                    </Link>
                    <form action={cambiarEstadoClinica.bind(null, c.id, !c.activa)}>
                      <button className={c.activa ? "boton-peligro" : "boton-secundario"}>
                        {c.activa ? "Desactivar" : "Activar"}
                      </button>
                    </form>
                  </div>
                </div>
                <Formulario accion={invitarAdmin.bind(null, c.id)} limpiarAlTerminar className="mt-4 flex flex-wrap items-end gap-2">
                  <Campo etiqueta="Invitar a otra persona como admin" className="min-w-64 flex-1">
                    <input className="campo" type="email" name="email" required placeholder="email@clinica.es" />
                  </Campo>
                  <BotonEnviar variante="secundario">Invitar</BotonEnviar>
                </Formulario>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
