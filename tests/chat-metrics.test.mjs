import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, rm, writeFile, readFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import {
  medirRespuesta,
  resumirMetricas,
  agregarConsultas,
  filtrosMetricasSchema,
  saldoChatSchema,
} from "../src/lib/chat-metrics-model.ts";
import { leerMetricas, comenzarMedicion, guardarSaldo } from "../src/lib/chat-metrics.server.ts";
const response = {
  model: "gpt-4.1-mini-2025-04-14",
  service_tier: "default",
  usage: { input_tokens: 1000, input_tokens_details: { cached_tokens: 200 }, output_tokens: 200 },
};
const user = { id: 9, nombre: "Cliente Prueba", rol: "cliente", clienteId: 1, canal: "b2c" };
async function temp(fn) {
  const dir = await mkdtemp(join(tmpdir(), "bimbo-metrics-"));
  try {
    await fn(dir);
  } finally {
    assert.ok(
      resolve(dir).startsWith(resolve(tmpdir()) + "\\bimbo-metrics-") ||
        resolve(dir).startsWith(resolve(tmpdir()) + "/bimbo-metrics-"),
    );
    await rm(dir, { recursive: true, force: true });
  }
}
test("cost uses uncached input + cached input + output without double counting", () => {
  const m = medirRespuesta(response);
  assert.equal(m.costoNano, 660000);
  assert.equal(m.entrada, 1000);
  assert.equal(m.cache, 200);
  assert.equal(m.salida, 200);
});
test("missing usage, malformed tokens, unknown model and nonstandard tier never fake a free call", () => {
  for (const r of [
    {},
    { ...response, model: "unknown" },
    { ...response, service_tier: "priority" },
    {
      ...response,
      usage: { input_tokens: 10, output_tokens: 2, input_tokens_details: { cached_tokens: 11 } },
    },
  ])
    assert.equal(medirRespuesta(r).costoNano, null);
});
test("one query counts multiple calls, preserves costs before failure, stores no conversations", () =>
  temp(async (dir) => {
    await writeFile(join(dir, "chat-usage.json"), JSON.stringify({ day: "2026-11-13", count: 6 }));
    await leerMetricas(dir);
    const tracker = await comenzarMedicion(user, "b2c", "gpt-4.1-mini", dir);
    let n = 0;
    const call = tracker.envolver(async () => {
      if (++n === 2) throw new Error("secret-response");
      return response;
    });
    await call({ input: "secret-question" });
    await assert.rejects(() => call({ input: "secret-question" }));
    await tracker.terminar("error");
    const d = await leerMetricas(dir),
      s = agregarConsultas(d.consultas);
    assert.equal(s.consultas, 1);
    assert.equal(s.llamadas, 2);
    assert.equal(s.costoUSD, 0.00066);
    assert.equal(s.sinCosto, 1);
    assert.equal(s.errores, 1);
    assert.equal(d.previas.consultas, 6);
    const text = await readFile(join(dir, "chat-metrics.json"), "utf8");
    assert.ok(!text.includes("secret-question") && !text.includes("secret-response"));
  }));
test("separate processes can update different queries without lost records", () =>
  temp(async (dir) => {
    const trackers = await Promise.all(
      Array.from({ length: 5 }, (_, id) =>
        comenzarMedicion({ ...user, id }, "b2c", "gpt-4.1-mini", dir),
      ),
    );
    await Promise.all(
      trackers.map(async (t) => {
        await t.envolver(async () => response)({});
        await t.terminar("respondida");
      }),
    );
    const d = await leerMetricas(dir);
    assert.equal(d.consultas.length, 5);
    assert.equal(agregarConsultas(d.consultas).llamadas, 5);
    assert.equal(agregarConsultas(d.consultas).respondidas, 5);
  }));
test("balance reference revisions prevent overwrites", () =>
  temp(async (dir) => {
    const a = await guardarSaldo(5, null, dir);
    await assert.rejects(() => guardarSaldo(9, null, dir));
    await guardarSaldo(4.95, a.revision, dir);
    assert.equal((await leerMetricas(dir)).saldo.usd, 4.95);
  }));
test("date and role filters use Lima while balance ignores report filters", () => {
  const call = {
    inicio: "2026-11-14T06:00:00Z",
    fin: "2026-11-14T06:00:01Z",
    estado: "recibida",
    ...medirRespuesta(response),
  };
  const row = {
    id: "1",
    fecha: "2026-11-14T03:00:00Z",
    fin: "2026-11-14T06:00:01Z",
    usuarioId: 9,
    usuario: "Cliente",
    rol: "cliente",
    canal: "b2c",
    estado: "respondida",
    llamadas: [call],
  };
  const store = {
    inicio: "2026-11-13T12:00:00Z",
    previas: null,
    saldo: { usd: 5, fecha: "2026-11-14T05:00:00Z", revision: "a" },
    consultas: [row],
  };
  const s = resumirMetricas(store, { desde: "2026-11-13", hasta: "2026-11-13", rol: "cliente" });
  assert.equal(s.total.consultas, 1);
  assert.equal(s.saldo.restanteUSD, 4.99934);
  const empty = resumirMetricas(store, { desde: "2026-11-14", hasta: "2026-11-14", rol: "admin" });
  assert.equal(empty.total.consultas, 0);
  assert.equal(empty.saldo.restanteUSD, s.saldo.restanteUSD);
  row.llamadas.push({ ...call, costoNano: null });
  assert.equal(
    resumirMetricas(store, { desde: "", hasta: "", rol: "todos" }).saldo.restanteUSD,
    null,
  );
});
test("in-flight call spanning balance reference makes remaining balance unconfirmed", () => {
  const row = {
    id: "1",
    fecha: "2026-11-13T10:00:00Z",
    fin: null,
    usuarioId: 9,
    usuario: "Cliente",
    rol: "cliente",
    canal: "b2c",
    estado: "en_curso",
    llamadas: [
      {
        inicio: "2026-11-13T10:00:00Z",
        fin: null,
        estado: "en_curso",
        modelo: "gpt-4.1-mini",
        entrada: null,
        cache: null,
        salida: null,
        costoNano: null,
      },
    ],
  };
  const s = resumirMetricas(
    {
      inicio: row.fecha,
      previas: null,
      saldo: { usd: 5, fecha: "2026-11-13T10:00:02Z", revision: "x" },
      consultas: [row],
    },
    { desde: "", hasta: "", rol: "todos" },
    "2026-11-13T10:10:00Z",
  );
  assert.equal(s.saldo.restanteUSD, null);
  assert.equal(s.total.errores, 1);
});
test("invalid dates, identity injections and fractional cents rejected", () => {
  assert.equal(filtrosMetricasSchema.safeParse({ desde: "2026-02-30" }).success, false);
  assert.equal(
    filtrosMetricasSchema.safeParse({ desde: "2026-12-01", hasta: "2026-11-01" }).success,
    false,
  );
  for (const v of [-1, 0.001, 100001])
    assert.equal(saldoChatSchema.safeParse({ usd: v, revision: null }).success, false);
  assert.equal(saldoChatSchema.safeParse({ usd: 5, revision: null, rol: "admin" }).success, false);
});
test("corrupted metrics fail closed instead of losing billing records", () =>
  temp(async (dir) => {
    await writeFile(join(dir, "chat-metrics.json"), "bad json");
    await assert.rejects(() => leerMetricas(dir));
    assert.equal(await readFile(join(dir, "chat-metrics.json"), "utf8"), "bad json");
  }));
