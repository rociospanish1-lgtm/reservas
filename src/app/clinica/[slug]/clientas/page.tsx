import Link from "next/link";
import { Etiqueta, Titulo, Vacio } from "@/components/ui";
import { obtenerContextoClinica } from "@/lib/sesion";
import { formatearTelefono, normalizarTelefono } from "@/lib/telefono";
import type { Clienta } from "@/lib/tipos";

export const metadata = { title: "Clientas" };

const POR_PAGINA = 50;

export default async function PaginaClientas({ params, searchParams }: PageProps<"/clinica/[slug]/clientas">) {
  const { slug } = await params;
  const sp = await searchParams;
  const { supabase, clinica, esAdmin } = await obtenerContextoClinica(slug);
  const q = typeof sp.q === "string" ? sp.q.trim() : "";
  const pagina = Math.max(1, Number(sp.pagina) || 1);

  let consulta = supabase
    .from("clientas")
    .select("*", { count: "exact" })
    .eq("clinica_id", clinica.id)
    .is("anonimizada_at", null)
    .order("nombre")
    .range((pagina - 1) * POR_PAGINA, pagina * POR_PAGINA - 1);
  if (q) {
    const telefono = normalizarTelefono(q);
    const limpio = q.replace(/[%,()*\\]/g, " ");
    consulta = telefono ? consulta.eq("telefono", telefono) : consulta.or(`nombre.ilike.%${limpio}%,email.ilike.%${limpio}%`);
  }
  const { data, count } = await consulta;
  const clientas = (data ?? []) as Clienta[];
  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const enlacePagina = (n: number) => `/clinica/${slug}/clientas?${new URLSearchParams({ ...(q ? { q } : {}), pagina: String(n) })}`;

  return (
    <div className="space-y-4">
      <Titulo
        accion={
          esAdmin && (
            <Link href={`/clinica/${slug}/clientas/nueva`} className="boton">
              Nueva clienta
            </Link>
          )
        }
      >
        Clientas
      </Titulo>
      {!esAdmin && <p className="text-sm text-stone-600">Ves las clientas que tienen o han tenido cita contigo.</p>}

      <form className="flex gap-2">
        <input className="campo max-w-md" name="q" defaultValue={q} placeholder="Buscar por nombre, email o teléfono" aria-label="Buscar" />
        <button className="boton-secundario">Buscar</button>
      </form>

      {clientas.length === 0 ? (
        <Vacio>{q ? "No hay ninguna clienta que coincida." : "Todavía no hay clientas."}</Vacio>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-stone-200 bg-white">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left text-stone-500">
              <tr>
                <th className="px-4 py-2 font-medium">Nombre</th>
                <th className="px-4 py-2 font-medium">Teléfono</th>
                <th className="px-4 py-2 font-medium">Email</th>
                <th className="px-4 py-2 font-medium">Privacidad</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-stone-100">
              {clientas.map((c) => (
                <tr key={c.id} className="hover:bg-stone-50">
                  <td className="px-4 py-2">
                    <Link href={`/clinica/${slug}/clientas/${c.id}`} className="enlace">
                      {c.nombre}
                    </Link>
                  </td>
                  <td className="px-4 py-2 text-stone-700">{formatearTelefono(c.telefono)}</td>
                  <td className="px-4 py-2 text-stone-700">{c.email}</td>
                  <td className="px-4 py-2">
                    {c.consentimiento_privacidad_at ? <Etiqueta color="verde">Aceptada</Etiqueta> : <Etiqueta color="ambar">Pendiente</Etiqueta>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {paginas > 1 && (
        <div className="flex items-center gap-3 text-sm">
          {pagina > 1 && (
            <Link href={enlacePagina(pagina - 1)} className="boton-secundario">
              ← Anterior
            </Link>
          )}
          <span className="text-stone-600">
            Página {pagina} de {paginas} · {total} clientas
          </span>
          {pagina < paginas && (
            <Link href={enlacePagina(pagina + 1)} className="boton-secundario">
              Siguiente →
            </Link>
          )}
        </div>
      )}
    </div>
  );
}
