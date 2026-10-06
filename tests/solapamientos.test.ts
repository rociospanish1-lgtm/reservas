import { beforeAll, describe, expect, it } from "vitest";
import { crearEscenario, dentroDe, instante, reservar, servicio, sinError, type Escenario } from "./ayuda";

/**
 * REGLA CRÍTICA: nunca puede haber dos citas que se solapen en la misma
 * profesional ni en la misma cabina, ni siquiera si llegan a la vez.
 */
describe("Sin solapamientos", () => {
  let e: Escenario;
  beforeAll(async () => {
    e = await crearEscenario("Solapes");
  });

  it("no deja reservar dos veces la misma hora con la misma profesional", async () => {
    const dia = dentroDe(10);
    const primera = await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "10:00"), profesional: e.p1 });
    expect(primera.error).toBeNull();

    const segunda = await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "10:00"), profesional: e.p1, clienta: e.clienta2 });
    expect(segunda.error?.hint).toBe("HUECO_NO_DISPONIBLE");

    // Una cita que empieza a mitad de la otra también se rechaza
    const cruzada = await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "10:15"), profesional: e.p1, clienta: e.clienta2 });
    expect(cruzada.error).not.toBeNull();
  });

  it("permite una cita justo cuando acaba la anterior", async () => {
    const dia = dentroDe(11);
    expect((await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "10:00"), profesional: e.p1 })).error).toBeNull();
    expect((await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "10:30"), profesional: e.p1 })).error).toBeNull();
  });

  it("la base de datos rechaza el solapamiento aunque se intente saltar las comprobaciones", async () => {
    const dia = dentroDe(12);
    const base = {
      clinica_id: e.clinicaId,
      clienta_id: e.clienta,
      tratamiento_id: e.tSoloP1,
      profesional_id: e.p1,
      inicio: instante(dia, "11:00"),
      fin: instante(dia, "11:30"),
    };
    // Inserción directa con la clave de servicio (sin pasar por reservar_cita)
    expect((await servicio().from("citas").insert(base)).error).toBeNull();
    const repetida = await servicio()
      .from("citas")
      .insert({ ...base, inicio: instante(dia, "11:10"), fin: instante(dia, "11:40") });
    expect(repetida.error?.code).toBe("23P01"); // violación de la restricción de exclusión
  });

  it("no deja usar la misma cabina a la vez con dos profesionales distintas", async () => {
    const dia = dentroDe(13);
    const primera = await reservar(e, { tratamiento: e.tConCabina, inicio: instante(dia, "12:00"), profesional: e.p1 });
    expect(primera.error).toBeNull();
    const otraProfesional = await reservar(e, {
      tratamiento: e.tConCabina,
      inicio: instante(dia, "12:30"),
      profesional: e.p2,
      clienta: e.clienta2,
    });
    expect(otraProfesional.error?.hint).toBe("HUECO_NO_DISPONIBLE");

    // Y directamente en la tabla, tampoco
    const directa = await servicio().from("citas").insert({
      clinica_id: e.clinicaId,
      clienta_id: e.clienta2,
      tratamiento_id: e.tConCabina,
      profesional_id: e.p2,
      cabina_id: e.cabina,
      inicio: instante(dia, "12:30"),
      fin: instante(dia, "13:30"),
    });
    expect(directa.error?.code).toBe("23P01");
  });

  it("al cancelar una cita, el hueco queda libre otra vez", async () => {
    const dia = dentroDe(14);
    const r = await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "17:00"), profesional: e.p1 });
    expect(r.error).toBeNull();
    sinError(await servicio().from("citas").update({ estado: "cancelada", cancelada_por: "clienta" }).eq("id", r.data));
    const otra = await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "17:00"), profesional: e.p1, clienta: e.clienta2 });
    expect(otra.error).toBeNull();
  });

  it("si cinco personas reservan el mismo hueco a la vez, solo una lo consigue", async () => {
    const dia = dentroDe(15);
    const intentos = await Promise.all(
      Array.from({ length: 5 }, (_, i) =>
        reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "15:00"), profesional: e.p1, clienta: i % 2 ? e.clienta : e.clienta2 }),
      ),
    );
    expect(intentos.filter((r) => r.error === null)).toHaveLength(1);
    const { count } = await servicio()
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("profesional_id", e.p1)
      .eq("inicio", instante(dia, "15:00"))
      .neq("estado", "cancelada");
    expect(count).toBe(1);
  });

  it("con «cualquiera» y reservas simultáneas, reparte entre las profesionales libres sin solapar", async () => {
    const dia = dentroDe(16);
    const intentos = await Promise.all(
      Array.from({ length: 3 }, () => reservar(e, { tratamiento: e.tAmbas, inicio: instante(dia, "16:00"), profesional: null })),
    );
    // Hay dos profesionales libres: dos reservas entran, la tercera no
    expect(intentos.filter((r) => r.error === null)).toHaveLength(2);
    const citas = sinError(
      await servicio().from("citas").select("profesional_id").eq("clinica_id", e.clinicaId).eq("inicio", instante(dia, "16:00")),
    ) as { profesional_id: string }[];
    expect(new Set(citas.map((c) => c.profesional_id))).toEqual(new Set([e.p1, e.p2]));
  });
});

describe("Horarios, festivos y ausencias", () => {
  let e: Escenario;
  beforeAll(async () => {
    e = await crearEscenario("Horarios");
  });

  const huecos = (fecha: string, tratamiento: string, profesional: string | null = null) =>
    servicio().rpc("huecos_libres", {
      p_clinica_id: e.clinicaId,
      p_tratamiento_id: tratamiento,
      p_profesional_id: profesional,
      p_desde: fecha,
      p_hasta: fecha,
    });

  it("no ofrece ni deja reservar fuera del horario", async () => {
    const dia = dentroDe(20);
    const r = await reservar(e, { tratamiento: e.tSoloP1, inicio: instante(dia, "07:00"), profesional: e.p1 });
    expect(r.error?.hint).toBe("HUECO_NO_DISPONIBLE");
    const lista = sinError(await huecos(dia, e.tSoloP1)) as { inicio: string }[];
    expect(lista.length).toBeGreaterThan(0);
    const ms = (iso: string) => new Date(iso).getTime();
    expect(lista.every((h) => ms(h.inicio) >= ms(instante(dia, "08:00")))).toBe(true);
    // El último hueco de 30 min empieza a las 21:30
    expect(ms(lista[lista.length - 1].inicio)).toBe(ms(instante(dia, "21:30")));
  });

  it("no ofrece huecos en un festivo", async () => {
    const dia = dentroDe(21);
    sinError(await servicio().from("cierres_clinica").insert({ clinica_id: e.clinicaId, fecha_inicio: dia, fecha_fin: dia, motivo: "Festivo" }));
    expect(sinError(await huecos(dia, e.tAmbas))).toHaveLength(0);
    const r = await reservar(e, { tratamiento: e.tAmbas, inicio: instante(dia, "10:00") });
    expect(r.error?.hint).toBe("HUECO_NO_DISPONIBLE");
  });

  it("no ofrece huecos con una profesional ausente, pero sí con la otra", async () => {
    const dia = dentroDe(22);
    sinError(
      await servicio()
        .from("ausencias_profesional")
        .insert({ clinica_id: e.clinicaId, profesional_id: e.p2, inicio: instante(dia, "00:00"), fin: instante(dentroDe(23), "00:00") }),
    );
    expect(sinError(await huecos(dia, e.tAmbas, e.p2))).toHaveLength(0);
    const conCualquiera = sinError(await huecos(dia, e.tAmbas)) as { profesional_id: string }[];
    expect(conCualquiera.length).toBeGreaterThan(0);
    expect(conCualquiera.every((h) => h.profesional_id === e.p1)).toBe(true);
  });

  it("solo ofrece profesionales que hacen ese tratamiento", async () => {
    const lista = sinError(await huecos(dentroDe(24), e.tSoloP1)) as { profesional_id: string }[];
    expect(lista.every((h) => h.profesional_id === e.p1)).toBe(true);
  });
});
