import { describe, expect, it } from "vitest";
import { normalizarTelefono } from "@/lib/telefono";

describe("Teléfonos: siempre en formato internacional", () => {
  it.each([
    ["612 34 56 78", "+34612345678"],
    ["612-345-678", "+34612345678"],
    ["+34 612 345 678", "+34612345678"],
    ["0034612345678", "+34612345678"],
    ["34612345678", "+34612345678"], // así lo envía WhatsApp
    ["954 00 00 00", "+34954000000"], // fijo
    ["+33 6 12 34 56 78", "+33612345678"], // extranjero
  ])("%s -> %s", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it.each(["", "   ", "abc", "123", "6123"])("rechaza %j", (entrada) => {
    expect(normalizarTelefono(entrada)).toBeNull();
  });

  it("el mismo número escrito de formas distintas da el mismo resultado", () => {
    const formas = ["612345678", "+34612345678", "0034 612 345 678", "34612345678"];
    expect(new Set(formas.map(normalizarTelefono)).size).toBe(1);
  });
});
