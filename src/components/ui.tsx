import type { ReactNode } from "react";

export function Campo({
  etiqueta,
  ayuda,
  children,
  className = "",
}: {
  etiqueta: string;
  ayuda?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={`block ${className}`}>
      <span className="etiqueta">{etiqueta}</span>
      {children}
      {ayuda && <span className="mt-1 block text-xs text-stone-500">{ayuda}</span>}
    </label>
  );
}

export function Titulo({ children, accion }: { children: ReactNode; accion?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
      <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{children}</h1>
      {accion}
    </div>
  );
}

export function Seccion({
  titulo,
  descripcion,
  children,
}: {
  titulo: string;
  descripcion?: string;
  children: ReactNode;
}) {
  return (
    <section className="tarjeta">
      <h2 className="text-lg font-semibold text-stone-900">{titulo}</h2>
      {descripcion && <p className="mt-1 text-sm text-stone-600">{descripcion}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

export function Etiqueta({ children, color = "stone" }: { children: ReactNode; color?: "stone" | "verde" | "ambar" | "rojo" | "marca" }) {
  const colores = {
    stone: "bg-stone-100 text-stone-700",
    verde: "bg-emerald-100 text-emerald-800",
    ambar: "bg-amber-100 text-amber-800",
    rojo: "bg-red-100 text-red-700",
    marca: "bg-marca-100 text-marca-700",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${colores[color]}`}>
      {children}
    </span>
  );
}

export function Vacio({ children }: { children: ReactNode }) {
  return <p className="rounded-lg border border-dashed border-stone-300 p-6 text-center text-sm text-stone-500">{children}</p>;
}
