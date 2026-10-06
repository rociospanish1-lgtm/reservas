import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import { crearEscenario, crearUsuario, dentroDe, hacerMiembro, instante, reservar, servicio, sinError, type Escenario } from "./ayuda";

let e: Escenario;
let admin: SupabaseClient;

beforeAll(async () => {
  e = await crearEscenario("RGPD");
  const u = await crearUsuario();
  await hacerMiembro(u.id, e.clinicaId, "admin");
  admin = u.cliente;
});

describe("Derecho de supresión (anonimizar)", () => {
  it("borra los datos personales, cancela lo futuro y conserva el historial sin nombre", async () => {
    const svc = servicio();
    const pasada = sinError(
      await svc
        .from("citas")
        .insert({
          clinica_id: e.clinicaId,
          clienta_id: e.clienta,
          tratamiento_id: e.tAmbas,
          profesional_id: e.p1,
          inicio: instante(dentroDe(-10), "10:00"),
          fin: instante(dentroDe(-10), "10:30"),
          estado: "completada",
          notas: "Le encantó",
        })
        .select("id")
        .single(),
    ).id as string;
    const futura = sinError(await reservar(e, { tratamiento: e.tAmbas, inicio: instante(dentroDe(40), "10:00"), profesional: e.p1 })) as string;
    sinError(await svc.from("notas_clinicas").insert({ clienta_id: e.clienta, clinica_id: e.clinicaId, texto: "Alergia ficticia" }));
    sinError(await svc.from("clientas").update({ email: "borrame@correo.example", notas_asistente: "Prefiere tardes" }).eq("id", e.clienta));

    expect((await admin.rpc("anonimizar_clienta", { p_clienta_id: e.clienta })).error).toBeNull();

    const clienta = sinError(await svc.from("clientas").select("*").eq("id", e.clienta).single()) as Record<string, unknown>;
    expect(clienta.nombre).toBe("Clienta eliminada");
    expect(clienta.telefono).toBeNull();
    expect(clienta.email).toBeNull();
    expect(clienta.notas_asistente).toBeNull();
    expect(clienta.anonimizada_at).not.toBeNull();
    expect(sinError(await svc.from("notas_clinicas").select("*").eq("clienta_id", e.clienta))).toEqual([]);

    const citaPasada = sinError(await svc.from("citas").select("estado, notas").eq("id", pasada).single()) as Record<string, unknown>;
    expect(citaPasada).toEqual({ estado: "completada", notas: null });
    const citaFutura = sinError(await svc.from("citas").select("estado").eq("id", futura).single()) as Record<string, unknown>;
    expect(citaFutura.estado).toBe("cancelada");

    const solicitudes = sinError(await svc.from("solicitudes_rgpd").select("tipo, resuelta_at").eq("clienta_id", e.clienta)) as {
      tipo: string;
      resuelta_at: string | null;
    }[];
    expect(solicitudes).toHaveLength(1);
    expect(solicitudes[0].tipo).toBe("supresion");
    expect(solicitudes[0].resuelta_at).not.toBeNull();

    // Una clienta anonimizada no puede recibir citas nuevas
    const r = await reservar(e, { tratamiento: e.tAmbas, inicio: instante(dentroDe(41), "10:00"), profesional: e.p1 });
    expect(r.error).not.toBeNull();
  });
});

describe("Fusionar fichas duplicadas", () => {
  it("pasa las citas y los datos a la ficha que se conserva", async () => {
    const svc = servicio();
    const f = await crearEscenario("Fusión");
    sinError(await svc.from("clientas").update({ telefono: null }).eq("id", f.clienta));
    sinError(await svc.from("clientas").update({ telefono: "+34699111222", email: "dup@correo.example" }).eq("id", f.clienta2));
    const cita = sinError(await reservar(f, { tratamiento: f.tAmbas, inicio: instante(dentroDe(42), "10:00"), profesional: f.p1, clienta: f.clienta2 })) as string;
    const u = await crearUsuario();
    await hacerMiembro(u.id, f.clinicaId, "admin");

    expect((await u.cliente.rpc("fusionar_clientas", { p_conservar: f.clienta, p_eliminar: f.clienta2 })).error).toBeNull();

    const conservada = sinError(await svc.from("clientas").select("telefono, email").eq("id", f.clienta).single());
    expect(conservada).toEqual({ telefono: "+34699111222", email: "dup@correo.example" });
    expect(sinError(await svc.from("clientas").select("id").eq("id", f.clienta2))).toEqual([]);
    const c = sinError(await svc.from("citas").select("clienta_id").eq("id", cita).single()) as { clienta_id: string };
    expect(c.clienta_id).toBe(f.clienta);
  });
});

describe("Teléfono único por clínica", () => {
  it("no deja dos fichas con el mismo teléfono en la misma clínica, pero sí en clínicas distintas", async () => {
    const svc = servicio();
    const otra = await crearEscenario("Otra clínica");
    const tel = "+34677000111";
    sinError(await svc.from("clientas").insert({ clinica_id: e.clinicaId, nombre: "Una", telefono: tel }));
    const repetida = await svc.from("clientas").insert({ clinica_id: e.clinicaId, nombre: "Dos", telefono: tel });
    expect(repetida.error?.code).toBe("23505");
    expect((await svc.from("clientas").insert({ clinica_id: otra.clinicaId, nombre: "Tres", telefono: tel })).error).toBeNull();
  });

  it("la base de datos rechaza teléfonos que no están en formato internacional", async () => {
    const r = await servicio().from("clientas").insert({ clinica_id: e.clinicaId, nombre: "Mal", telefono: "612345678" });
    expect(r.error?.code).toBe("23514");
  });
});
