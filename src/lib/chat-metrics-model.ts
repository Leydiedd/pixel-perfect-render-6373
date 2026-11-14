import { z } from "zod";
import { fechaValida } from "./report-details.ts";
export const tarifaChat = {
  modelo: "gpt-4.1-mini",
  entrada: 0.4,
  cache: 0.1,
  salida: 1.6,
  verificada: "2026-11-13",
  unidad: "USD por millón de tokens",
  url: "https://developers.openai.com/api/docs/models/gpt-4.1-mini",
};
const entero = z.number().int().nonnegative();
export const llamadaSchema = z.object({
  inicio: z.string(),
  fin: z.string().nullable(),
  modelo: z.string(),
  estado: z.enum(["en_curso", "recibida", "error"]),
  entrada: entero.nullable(),
  cache: entero.nullable(),
  salida: entero.nullable(),
  costoNano: entero.nullable(),
});
export const registroChatSchema = z.object({
  id: z.string().uuid(),
  fecha: z.string(),
  fin: z.string().nullable(),
  usuarioId: entero,
  usuario: z.string(),
  rol: z.enum(["admin", "cliente"]),
  canal: z.enum(["b2b", "b2c"]),
  estado: z.enum(["en_curso", "respondida", "error"]),
  llamadas: z.array(llamadaSchema),
});
export const metricasSchema = z.object({
  version: z.literal(1),
  inicio: z.string(),
  previas: z.object({ dia: z.string(), consultas: entero }).nullable(),
  saldo: z
    .object({ usd: z.number().finite().nonnegative(), fecha: z.string(), revision: z.string() })
    .nullable(),
  consultas: z.array(registroChatSchema),
});
export type RegistroChat = z.infer<typeof registroChatSchema>;
export type MetricasChat = z.infer<typeof metricasSchema>;
export const filtrosMetricasSchema = z
  .object({
    desde: z.string().default(""),
    hasta: z.string().default(""),
    rol: z.enum(["todos", "admin", "cliente"]).default("todos"),
  })
  .strict()
  .refine(
    (v) =>
      (!v.desde || fechaValida(v.desde)) &&
      (!v.hasta || fechaValida(v.hasta)) &&
      (!v.desde || !v.hasta || v.desde <= v.hasta),
  );
export const saldoChatSchema = z
  .object({
    usd: z
      .number()
      .finite()
      .min(0)
      .max(100000)
      .refine((v) => Math.abs(v * 100 - Math.round(v * 100)) < 0.000001),
    revision: z.string().nullable(),
  })
  .strict();
export function medirRespuesta(r: any) {
  const modelo = typeof r?.model === "string" ? r.model : "desconocido";
  const uso = z
    .object({
      input_tokens: entero,
      output_tokens: entero,
      input_tokens_details: z.object({ cached_tokens: entero }).optional(),
    })
    .safeParse(r?.usage);
  if (!uso.success) return { modelo, entrada: null, cache: null, salida: null, costoNano: null };
  const entrada = uso.data.input_tokens,
    cache = uso.data.input_tokens_details?.cached_tokens ?? 0,
    salida = uso.data.output_tokens;
  if (cache > entrada) return { modelo, entrada: null, cache: null, salida: null, costoNano: null };
  const conocido =
    /^gpt-4\.1-mini(?:-2025-04-14)?$/.test(modelo) &&
    (!r.service_tier || r.service_tier === "default");
  return {
    modelo,
    entrada,
    cache,
    salida,
    costoNano: conocido ? (entrada - cache) * 400 + cache * 100 + salida * 1600 : null,
  };
}
export function diaLima(iso: string) {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/Lima",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date(iso));
}
export function agregarConsultas(rows: RegistroChat[]) {
  const calls = rows.flatMap((r) => r.llamadas);
  return {
    consultas: rows.length,
    respondidas: rows.filter((r) => r.estado === "respondida").length,
    errores: rows.filter((r) => r.estado === "error").length,
    enCurso: rows.filter((r) => r.estado === "en_curso").length,
    usuarios: new Set(rows.map((r) => r.usuarioId)).size,
    llamadas: calls.length,
    entrada: calls.reduce((s, c) => s + (c.entrada ?? 0), 0),
    cache: calls.reduce((s, c) => s + (c.cache ?? 0), 0),
    salida: calls.reduce((s, c) => s + (c.salida ?? 0), 0),
    costoUSD: calls.reduce((s, c) => s + (c.costoNano ?? 0), 0) / 1e9,
    sinCosto: calls.filter((c) => c.costoNano === null).length,
  };
}
export function resumirMetricas(
  store: MetricasChat,
  filtros: z.infer<typeof filtrosMetricasSchema>,
  now = new Date().toISOString(),
) {
  const all = store.consultas.map((r) =>
    r.estado === "en_curso" && Date.parse(now) - Date.parse(r.fecha) > 300000
      ? { ...r, estado: "error" as const }
      : r,
  );
  const rows = all.filter((r) => {
    const d = diaLima(r.fecha);
    return (
      (!filtros.desde || d >= filtros.desde) &&
      (!filtros.hasta || d <= filtros.hasta) &&
      (filtros.rol === "todos" || r.rol === filtros.rol)
    );
  });
  const days = [...new Set(rows.map((r) => diaLima(r.fecha)))].sort();
  const after = store.saldo
    ? all.flatMap((r) => r.llamadas).filter((c) => c.inicio >= store.saldo!.fecha)
    : [];
  const overlap = store.saldo
    ? all
        .flatMap((r) => r.llamadas)
        .some((c) => c.inicio < store.saldo!.fecha && (!c.fin || c.fin > store.saldo!.fecha))
    : false;
  const unknown = after.some((c) => c.costoNano === null) || overlap;
  const spent = after.reduce((s, c) => s + (c.costoNano ?? 0), 0) / 1e9;
  return {
    inicio: store.inicio,
    previas: store.previas,
    consultadoEn: now,
    tarifa: tarifaChat,
    saldo: store.saldo
      ? {
          ...store.saldo,
          consumoUSD: spent,
          restanteUSD: unknown ? null : store.saldo.usd - spent,
          incompleto: unknown,
        }
      : null,
    total: agregarConsultas(rows),
    porPerfil: (["cliente", "admin"] as const).map((rol) => ({
      rol,
      ...agregarConsultas(rows.filter((r) => r.rol === rol)),
    })),
    porDia: days.map((dia) => ({
      dia,
      ...agregarConsultas(rows.filter((r) => diaLima(r.fecha) === dia)),
    })),
    recientes: [...rows]
      .sort((a, b) => b.fecha.localeCompare(a.fecha))
      .slice(0, 50)
      .map((r) => ({
        id: r.id,
        fecha: r.fecha,
        usuario: r.usuario,
        rol: r.rol,
        canal: r.canal,
        estado: r.estado,
        modelos: [...new Set(r.llamadas.map((c) => c.modelo))].join(", "),
        ...agregarConsultas([r]),
      })),
  };
}
export type ResumenMetricas = ReturnType<typeof resumirMetricas>;
