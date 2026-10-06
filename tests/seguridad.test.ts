import { beforeAll, describe, expect, it } from "vitest";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  anonimo,
  crearEscenario,
  crearUsuario,
  dentroDe,
  hacerMiembro,
  instante,
  reservar,
  servicio,
  sinError,
  type Escenario,
} from "./ayuda";

/**
 * REGLA CRÍTICA: cada clínica solo ve lo suyo. Se comprueba en la base de datos
 * (seguridad por filas), con usuarios reales que inician sesión.
 */

const TABLAS = [
  "clinicas",
  "miembros",
  "profesionales",
  "horarios_clinica",
  "cierres_clinica",
  "horarios_profesional",
  "ausencias_profesional",
  "cabinas",
  "tratamientos",
  "tratamiento_profesionales",
  "tratamiento_cabinas",
  "clientas",
  "notas_clinicas",
  "citas",
  "conversaciones",
  "mensajes",
  "avisos",
  "solicitudes_rgpd",
  "uso_ia",
  "importaciones",
] as const;

let A: Escenario;
let B: Escenario;
let adminA: SupabaseClient;
let adminB: SupabaseClient;
let profUnoA: SupabaseClient;
let citaUnoA: string;
let citaDosA: string;

beforeAll(async () => {
  [A, B] = await Promise.all([crearEscenario("Clínica A"), crearEscenario("Clínica B")]);
  const [uA, uB, uP] = await Promise.all([crearUsuario(), crearUsuario(), crearUsuario()]);
  await hacerMiembro(uA.id, A.clinicaId, "admin");
  await hacerMiembro(uB.id, B.clinicaId, "admin");
  await hacerMiembro(uP.id, A.clinicaId, "profesional", A.p1);
  adminA = uA.cliente;
  adminB = uB.cliente;
  profUnoA = uP.cliente;

  // Datos en las dos clínicas
  const dia = dentroDe(30);
  citaUnoA = sinError(await reservar(A, { tratamiento: A.tAmbas, inicio: instante(dia, "10:00"), profesional: A.p1 })) as string;
  citaDosA = sinError(
    await reservar(A, { tratamiento: A.tAmbas, inicio: instante(dia, "10:00"), profesional: A.p2, clienta: A.clienta2 }),
  ) as string;
  sinError(await reservar(B, { tratamiento: B.tAmbas, inicio: instante(dia, "10:00"), profesional: B.p1 }));
  const svc = servicio();
  sinError(await svc.from("notas_clinicas").insert({ clienta_id: A.clienta2, clinica_id: A.clinicaId, texto: "Nota de prueba" }));
  sinError(await svc.from("notas_clinicas").insert({ clienta_id: B.clienta, clinica_id: B.clinicaId, texto: "Nota de B" }));
});

describe("Cada clínica solo ve lo suyo", () => {
  it.each(TABLAS)("la admin de A no ve nada de B en «%s»", async (tabla) => {
    const columna = tabla === "clinicas" ? "id" : "clinica_id";
    const { data, error } = await adminA.from(tabla).select("*").eq(columna, B.clinicaId);
    expect(error).toBeNull();
    expect(data).toEqual([]);
  });

  it("la admin de A ve sus propios datos", async () => {
    const citas = sinError(await adminA.from("citas").select("id").eq("clinica_id", A.clinicaId)) as { id: string }[];
    expect(citas.map((c) => c.id).sort()).toEqual([citaUnoA, citaDosA].sort());
    const clinicas = sinError(await adminA.from("clinicas").select("id")) as { id: string }[];
    expect(clinicas.map((c) => c.id)).toEqual([A.clinicaId]);
  });

  it("la admin de A no puede modificar la clínica B", async () => {
    await adminA.from("clinicas").update({ nombre: "Hackeada" }).eq("id", B.clinicaId);
    await adminA.from("clientas").update({ nombre: "Hackeada" }).eq("id", B.clienta);
    const clinica = sinError(await servicio().from("clinicas").select("nombre").eq("id", B.clinicaId).single()) as { nombre: string };
    const clienta = sinError(await servicio().from("clientas").select("nombre").eq("id", B.clienta).single()) as { nombre: string };
    expect(clinica.nombre).not.toBe("Hackeada");
    expect(clienta.nombre).not.toBe("Hackeada");
  });

  it("la admin de A no puede crear datos en la clínica B", async () => {
    const r1 = await adminA.from("profesionales").insert({ clinica_id: B.clinicaId, nombre: "Intrusa" });
    const r2 = await adminA.from("clientas").insert({ clinica_id: B.clinicaId, nombre: "Intrusa" });
    expect(r1.error).not.toBeNull();
    expect(r2.error).not.toBeNull();
  });

  it("la admin de A no puede reservar en la clínica B", async () => {
    const r = await adminA.rpc("reservar_cita", {
      p_clinica_id: B.clinicaId,
      p_clienta_id: B.clienta,
      p_tratamiento_id: B.tAmbas,
      p_inicio: instante(dentroDe(31), "12:00"),
      p_profesional_id: B.p1,
      p_forzar: true,
    });
    expect(r.error?.code).toBe("42501");
  });

  it("no se puede mezclar: una cita de A con una profesional de B", async () => {
    const r = await adminA.rpc("reservar_cita", {
      p_clinica_id: A.clinicaId,
      p_clienta_id: A.clienta,
      p_tratamiento_id: A.tAmbas,
      p_inicio: instante(dentroDe(31), "13:00"),
      p_profesional_id: B.p1,
      p_forzar: true,
    });
    expect(r.error?.code).toBe("23503"); // la referencia compuesta (id + clínica) lo impide
  });

  it("la admin de A no puede anonimizar ni fusionar clientas de B", async () => {
    expect((await adminA.rpc("anonimizar_clienta", { p_clienta_id: B.clienta })).error?.code).toBe("42501");
    expect((await adminA.rpc("fusionar_clientas", { p_conservar: B.clienta, p_eliminar: B.clienta2 })).error?.code).toBe("42501");
  });

  it("la admin de B tampoco ve nada de A", async () => {
    const citas = sinError(await adminB.from("citas").select("clinica_id")) as { clinica_id: string }[];
    expect(citas.every((c) => c.clinica_id === B.clinicaId)).toBe(true);
  });
});

describe("La profesional solo ve su agenda", () => {
  it("ve sus citas y no las de su compañera", async () => {
    const citas = sinError(await profUnoA.from("citas").select("id")) as { id: string }[];
    expect(citas.map((c) => c.id)).toEqual([citaUnoA]);
  });

  it("solo ve las clientas que atiende y sus notas clínicas", async () => {
    const clientas = sinError(await profUnoA.from("clientas").select("id")) as { id: string }[];
    expect(clientas.map((c) => c.id)).toEqual([A.clienta]);
    const notas = sinError(await profUnoA.from("notas_clinicas").select("clienta_id")) as unknown[];
    expect(notas).toEqual([]); // la nota es de clienta2, que no es suya
  });

  it("puede marcar su cita como completada, pero no moverla ni cancelarla", async () => {
    expect((await profUnoA.from("citas").update({ estado: "completada" }).eq("id", citaUnoA)).error).toBeNull();
    const mover = await profUnoA
      .from("citas")
      .update({ inicio: instante(dentroDe(30), "18:00"), fin: instante(dentroDe(30), "18:30") })
      .eq("id", citaUnoA);
    expect(mover.error?.code).toBe("42501");
    const cancelar = await profUnoA.from("citas").update({ estado: "cancelada" }).eq("id", citaUnoA);
    expect(cancelar.error?.code).toBe("42501");
  });

  it("no puede tocar la cita de su compañera", async () => {
    await profUnoA.from("citas").update({ estado: "no_presentada" }).eq("id", citaDosA);
    const cita = sinError(await servicio().from("citas").select("estado").eq("id", citaDosA).single()) as { estado: string };
    expect(cita.estado).toBe("pendiente");
  });

  it("no puede cambiar la configuración de la clínica", async () => {
    const r = await profUnoA.from("tratamientos").insert({ clinica_id: A.clinicaId, nombre: "Nuevo", duracion_min: 30 });
    expect(r.error).not.toBeNull();
    expect((await profUnoA.rpc("reservar_cita", {
      p_clinica_id: A.clinicaId,
      p_clienta_id: A.clienta,
      p_tratamiento_id: A.tAmbas,
      p_inicio: instante(dentroDe(32), "10:00"),
      p_profesional_id: A.p1,
    })).error?.code).toBe("42501");
  });
});

describe("Visitante sin sesión", () => {
  it.each(TABLAS)("no puede leer «%s»", async (tabla) => {
    const { data, error } = await anonimo().from(tabla).select("*").limit(1);
    // O da error de permiso o no devuelve nada; nunca datos
    expect(error !== null || (Array.isArray(data) && data.length === 0)).toBe(true);
  });

  it("no puede escribir", async () => {
    const r = await anonimo().from("clientas").insert({ clinica_id: A.clinicaId, nombre: "Anónima" });
    expect(r.error).not.toBeNull();
  });

  it("no puede usar las funciones de reserva ni de huecos", async () => {
    const r1 = await anonimo().rpc("reservar_cita", {
      p_clinica_id: A.clinicaId,
      p_clienta_id: A.clienta,
      p_tratamiento_id: A.tAmbas,
      p_inicio: instante(dentroDe(33), "10:00"),
      p_origen: "web",
    });
    const r2 = await anonimo().rpc("huecos_libres", {
      p_clinica_id: A.clinicaId,
      p_tratamiento_id: A.tAmbas,
      p_profesional_id: null,
      p_desde: dentroDe(33),
      p_hasta: dentroDe(33),
    });
    expect(r1.error).not.toBeNull();
    expect(r2.error).not.toBeNull();
  });
});

describe("Superadmin y clínicas desactivadas", () => {
  it("una admin no puede activar/desactivar su clínica; el superadmin sí", async () => {
    const r = await adminA.from("clinicas").update({ activa: false }).eq("id", A.clinicaId);
    expect(r.error?.code).toBe("42501");

    const superU = await crearUsuario();
    sinError(await servicio().from("superadmins").insert({ user_id: superU.id }));
    const clinicas = sinError(await superU.cliente.from("clinicas").select("id")) as { id: string }[];
    expect(clinicas.map((c) => c.id)).toEqual(expect.arrayContaining([A.clinicaId, B.clinicaId]));

    // Desactivar la clínica B: su admin pierde el acceso
    expect((await superU.cliente.from("clinicas").update({ activa: false }).eq("id", B.clinicaId)).error).toBeNull();
    expect(sinError(await adminB.from("citas").select("id"))).toEqual([]);
    expect((await superU.cliente.from("clinicas").update({ activa: true }).eq("id", B.clinicaId)).error).toBeNull();
    expect((sinError(await adminB.from("citas").select("id")) as unknown[]).length).toBeGreaterThan(0);
  });

  it("una clínica desactivada no acepta reservas", async () => {
    const C = await crearEscenario("Desactivada");
    sinError(await servicio().from("clinicas").update({ activa: false }).eq("id", C.clinicaId));
    const r = await reservar(C, { tratamiento: C.tAmbas, inicio: instante(dentroDe(34), "10:00") });
    expect(r.error).not.toBeNull();
  });
});
