"use client";

import { useActionState, useEffect, useRef, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { EstadoAccion } from "@/lib/errores";

type Accion = (estado: EstadoAccion, datos: FormData) => Promise<EstadoAccion>;

/**
 * Formulario que llama a una acción del servidor y muestra el resultado
 * (mensaje de éxito o error) debajo.
 */
export function Formulario({
  accion,
  children,
  className,
  limpiarAlTerminar = false,
  confirmar,
}: {
  accion: Accion;
  children: ReactNode;
  className?: string;
  limpiarAlTerminar?: boolean;
  /** Si se indica, pide confirmación antes de enviar */
  confirmar?: string;
}) {
  const [estado, accionFormulario] = useActionState(accion, null);
  const ref = useRef<HTMLFormElement>(null);

  useEffect(() => {
    if (estado?.ok && limpiarAlTerminar) ref.current?.reset();
  }, [estado, limpiarAlTerminar]);

  return (
    <form
      ref={ref}
      action={accionFormulario}
      className={className}
      onSubmit={(e) => {
        if (confirmar && !window.confirm(confirmar)) e.preventDefault();
      }}
    >
      {children}
      {estado?.error && (
        <p role="alert" className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">
          {estado.error}
        </p>
      )}
      {estado?.ok && estado.mensaje && (
        <p role="status" className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
          {estado.mensaje}
        </p>
      )}
    </form>
  );
}

export function BotonEnviar({
  children,
  variante = "principal",
  className = "",
}: {
  children: ReactNode;
  variante?: "principal" | "secundario" | "peligro";
  className?: string;
}) {
  const { pending } = useFormStatus();
  const clase = variante === "principal" ? "boton" : variante === "secundario" ? "boton-secundario" : "boton-peligro";
  return (
    <button type="submit" disabled={pending} className={`${clase} ${className}`}>
      {pending ? "Guardando…" : children}
    </button>
  );
}
