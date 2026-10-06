import { parsePhoneNumberFromString } from "libphonenumber-js";

/**
 * Convierte un teléfono escrito de cualquier forma al formato internacional
 * (+34612345678). Es la "llave" para reconocer a una clienta, así que todo
 * teléfono que entra en el sistema (web, WhatsApp, panel, CSV) pasa por aquí.
 *
 * Acepta: "612 34 56 78", "+34 612-345-678", "0034612345678",
 * "34612345678" (como lo manda WhatsApp) y números extranjeros con prefijo.
 * Devuelve null si no es un teléfono válido.
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  let limpio = entrada.trim().replace(/[\s().\-/]/g, "");
  if (limpio === "") return null;
  if (limpio.startsWith("00")) limpio = `+${limpio.slice(2)}`;

  const candidatos = [limpio];
  // WhatsApp envía los números con prefijo pero sin "+"
  if (/^\d{11,15}$/.test(limpio)) candidatos.push(`+${limpio}`);

  for (const candidato of candidatos) {
    const numero = parsePhoneNumberFromString(candidato, "ES");
    if (numero?.isValid()) return numero.number;
  }
  return null;
}

/** Para mostrarlo bonito: "+34 612 34 56 78" */
export function formatearTelefono(e164: string | null | undefined): string {
  if (!e164) return "";
  const numero = parsePhoneNumberFromString(e164);
  return numero ? numero.formatInternational() : e164;
}
