import type { Tratamiento } from "@/lib/tipos";

/** "55,00 €", "desde 70,00 €" o "Precio no indicado" */
export function precioTexto(t: Pick<Tratamiento, "precio" | "precio_desde">): string {
  if (t.precio === null) return "Precio no indicado";
  const euros = new Intl.NumberFormat("es-ES", { style: "currency", currency: "EUR" }).format(Number(t.precio));
  return t.precio_desde ? `desde ${euros}` : euros;
}
