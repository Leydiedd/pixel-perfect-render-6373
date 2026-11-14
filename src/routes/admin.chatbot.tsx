import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Bot, RefreshCw, ExternalLink, Wallet } from "lucide-react";
import { toast } from "sonner";
import { jsonApi, storeHeaders } from "@/context/tienda";
import { Pagina, Metrica, Vacio } from "@/components/DatosReales";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import type { ResumenMetricas } from "@/lib/chat-metrics-model";
export const Route = createFileRoute("/admin/chatbot")({
  head: () => ({ meta: [{ title: "Consumo del chatbot — Bimbo" }] }),
  component: ConsumoChat,
});
type Data = ResumenMetricas & {
  cupo: { limite: number; utilizadas: number | null };
  modelo: string;
};
const usd = (v: number) =>
  new Intl.NumberFormat("es-PE", {
    style: "currency",
    currency: "USD",
    minimumFractionDigits: 4,
    maximumFractionDigits: 6,
  }).format(v);
const num = (v: number) => v.toLocaleString("es-PE");
const fecha = (v: string) =>
  new Date(v).toLocaleString("es-PE", {
    timeZone: "America/Lima",
    dateStyle: "short",
    timeStyle: "short",
  });
const estado = { respondida: "Respondida", error: "Fallida / interrumpida", en_curso: "En curso" };
function ConsumoChat() {
  const [desde, setDesde] = useState("");
  const [hasta, setHasta] = useState("");
  const [rol, setRol] = useState("todos");
  const [saldo, setSaldo] = useState("");
  const [editando, setEditando] = useState(false);
  const [guardando, setGuardando] = useState(false);
  const invalido = !!desde && !!hasta && desde > hasta;
  const q = useQuery<Data>({
    queryKey: ["chat-metricas", desde, hasta, rol],
    queryFn: () => jsonApi(`/api/chat-metricas?${new URLSearchParams({ desde, hasta, rol })}`),
    refetchInterval: 20000,
    retry: false,
    enabled: !invalido,
  });
  async function guardar() {
    if (!q.data) return;
    const n = Number(saldo);
    if (!saldo.trim() || !Number.isFinite(n) || n < 0) {
      toast.error("Indica el saldo actual en USD.");
      return;
    }
    setGuardando(true);
    try {
      await jsonApi("/api/chat-metricas", {
        method: "POST",
        headers: storeHeaders,
        body: JSON.stringify({ usd: n, revision: q.data.saldo?.revision ?? null }),
      });
      await q.refetch();
      setEditando(false);
      setSaldo("");
      toast.success("Referencia de saldo guardada.");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "No se pudo guardar.");
      void q.refetch();
    } finally {
      setGuardando(false);
    }
  }
  const d = q.data;
  return (
    <Pagina
      titulo="Consumo del chatbot"
      descripcion="Consultas de la tienda y administración, tokens utilizados y costo estimado en dólares."
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Bot className="size-4" />
          Medición local · actualización cada 20 segundos
        </p>
        <Button
          variant="outline"
          disabled={q.isFetching || invalido}
          onClick={() => void q.refetch()}
        >
          <RefreshCw className={`size-4 ${q.isFetching ? "animate-spin" : ""}`} />
          Actualizar consumo
        </Button>
      </div>
      <Card className="flex flex-wrap items-end gap-4 p-4">
        <label className="grid gap-1 text-xs">
          Desde
          <input
            aria-label="Consumo desde"
            type="date"
            value={desde}
            onChange={(e) => setDesde(e.target.value)}
            className="rounded-md border bg-background p-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Hasta
          <input
            aria-label="Consumo hasta"
            type="date"
            value={hasta}
            onChange={(e) => setHasta(e.target.value)}
            className="rounded-md border bg-background p-2 text-sm"
          />
        </label>
        <label className="grid gap-1 text-xs">
          Perfil
          <select
            aria-label="Perfil del chatbot"
            value={rol}
            onChange={(e) => setRol(e.target.value)}
            className="rounded-md border bg-background p-2 text-sm"
          >
            <option value="todos">Todos los perfiles</option>
            <option value="cliente">Clientes de la tienda</option>
            <option value="admin">Administradores</option>
          </select>
        </label>
        <Button
          variant="ghost"
          onClick={() => {
            setDesde("");
            setHasta("");
            setRol("todos");
          }}
        >
          Todo el registro
        </Button>
      </Card>
      {invalido ? (
        <p role="alert" className="text-sm text-red-700">
          La fecha inicial debe ser anterior o igual a la final.
        </p>
      ) : q.isPending ? (
        <p role="status">Consultando consumo…</p>
      ) : q.isError ? (
        <p role="alert" className="rounded-xl bg-red-50 p-4 text-red-800">
          {q.error.message}
        </p>
      ) : (
        d && (
          <>
            <div className="rounded-xl border border-blue-100 bg-blue-50 p-4 text-xs leading-relaxed text-blue-900">
              Medición detallada desde {fecha(d.inicio)} (Lima).{" "}
              {d.previas?.consultas
                ? `Al activarla había ${d.previas.consultas} consultas reservadas en el cupo del ${d.previas.dia}; sus tokens y costos no se recuperaron. `
                : ""}
              Los importes corresponden a esta web, no a otras aplicaciones que usen tu API key.
            </div>
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <Metrica
                titulo="Consultas registradas"
                valor={num(d.total.consultas)}
                detalle={`${d.total.respondidas} respondidas · ${d.total.errores} fallidas · ${d.total.enCurso} en curso`}
              />
              <Metrica
                titulo="Llamadas a OpenAI"
                valor={num(d.total.llamadas)}
                detalle="Una consulta puede requerir hasta 3 llamadas."
              />
              <Metrica
                titulo="Tokens reportados"
                valor={num(d.total.entrada + d.total.salida)}
                detalle={`${num(d.total.entrada)} entrada · ${num(d.total.salida)} salida · ${num(d.total.cache)} de entrada en caché`}
              />
              <Metrica
                titulo="Costo estimado del período"
                valor={usd(d.total.costoUSD)}
                detalle={
                  d.total.sinCosto
                    ? `${d.total.sinCosto} llamadas sin costo calculable; este subtotal está incompleto.`
                    : "Calculado con los tokens reportados por OpenAI."
                }
              />
            </div>
            <div className="grid gap-4 lg:grid-cols-3">
              <Card className="space-y-4 bg-[#20344e] p-5 text-white lg:col-span-2">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <h2 className="flex items-center gap-2 font-semibold">
                    <Wallet className="size-5" />
                    Saldo estimado global
                  </h2>
                  <a
                    href="https://platform.openai.com/settings/organization/billing/overview"
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-1 text-xs underline"
                  >
                    Ver saldo real en OpenAI <ExternalLink className="size-3" />
                  </a>
                </div>
                <p className="text-3xl font-bold tabular-nums">
                  {d.saldo
                    ? d.saldo.restanteUSD === null
                      ? "Sin confirmar"
                      : usd(d.saldo.restanteUSD)
                    : "Sin referencia de saldo"}
                </p>
                <p className="text-xs leading-relaxed text-white/80">
                  {d.saldo
                    ? `Referencia registrada: ${usd(d.saldo.usd)} el ${fecha(d.saldo.fecha)}. Consumo estimado posterior conocido: ${usd(d.saldo.consumoUSD)}.`
                    : "Copia el saldo actual que ves en OpenAI para estimar cuánto queda después de las próximas consultas."}{" "}
                  {d.saldo?.incompleto
                    ? "Hay llamadas pendientes o sin costo confirmado; revisa el saldo real en OpenAI."
                    : ""}{" "}
                  Este cálculo no incluye recargas, vencimientos de crédito, impuestos ni consumo
                  fuera de esta web. No depende del filtro de fechas.
                </p>
                <Button variant="secondary" onClick={() => setEditando(!editando)}>
                  {editando
                    ? "Cerrar formulario"
                    : d.saldo
                      ? "Actualizar referencia de saldo"
                      : "Registrar saldo actual"}
                </Button>
                {editando && (
                  <form
                    className="space-y-3 rounded-xl bg-white/10 p-4"
                    onSubmit={(e) => {
                      e.preventDefault();
                      void guardar();
                    }}
                  >
                    <label className="grid gap-1 text-sm">
                      Saldo actual mostrado en OpenAI (USD)
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100000"
                        required
                        value={saldo}
                        onChange={(e) => setSaldo(e.target.value)}
                        className="w-full rounded-md border bg-white p-2 text-slate-900"
                        placeholder="Importe del portal de OpenAI"
                      />
                    </label>
                    <p className="text-xs text-white/80">
                      Guardar establece una nueva referencia desde este momento; no realiza una
                      recarga ni cambia tu cuenta de OpenAI.
                    </p>
                    <Button type="submit" disabled={guardando} variant="secondary">
                      {guardando ? "Guardando…" : "Guardar referencia"}
                    </Button>
                  </form>
                )}
              </Card>
              <Card className="space-y-3 p-5">
                <h2 className="font-semibold">Uso diario compartido</h2>
                <p className="text-3xl font-bold">
                  {d.cupo.utilizadas === null ? "Sin dato" : d.cupo.utilizadas}{" "}
                  <span className="text-lg font-normal text-muted-foreground">
                    {d.cupo.limite === 0 ? "· Sin límite diario" : `/ ${d.cupo.limite}`}
                  </span>
                </p>
                <p className="text-xs text-muted-foreground">
                  Consultas reservadas hoy (Lima), incluidas las fallidas y anteriores a la
                  medición. Se reinicia cada día. El cupo no es un límite de gasto en USD.
                </p>
                <p className="break-all text-xs">
                  Modelo configurado: <strong>{d.modelo}</strong>
                </p>
                <a
                  className="inline-flex items-center gap-1 text-xs text-blue-800 underline"
                  href="https://platform.openai.com/usage"
                  target="_blank"
                  rel="noreferrer"
                >
                  Ver consumo oficial <ExternalLink className="size-3" />
                </a>
              </Card>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              {d.porPerfil.map((p) => (
                <Card key={p.rol} className="p-5">
                  <h2 className="font-semibold">
                    {p.rol === "cliente" ? "Clientes de la tienda" : "Administración"}
                  </h2>
                  <p className="mt-2 text-2xl font-bold">
                    {p.consultas} <span className="text-sm font-normal">consultas</span>
                  </p>
                  <p className="mt-2 text-sm">
                    {p.usuarios} usuarios · {usd(p.costoUSD)} estimados
                  </p>
                  {p.sinCosto > 0 && (
                    <p className="text-xs text-amber-800">
                      Costo incompleto en {p.sinCosto} llamadas.
                    </p>
                  )}
                </Card>
              ))}
            </div>
            <Card className="p-5">
              <h2 className="mb-4 font-semibold">Consultas por día</h2>
              {!d.porDia.length ? (
                <Vacio>
                  Aún no hay consultas para este filtro. Usa el asistente y actualiza esta página.
                </Vacio>
              ) : (
                <div className="space-y-3">
                  {d.porDia.map((day) => (
                    <div
                      key={day.dia}
                      className="grid grid-cols-[90px_1fr] items-center gap-3 text-xs sm:grid-cols-[90px_1fr_170px]"
                    >
                      <span>{day.dia}</span>
                      <div className="h-7 overflow-hidden rounded bg-slate-100">
                        <div
                          className="flex h-full min-w-8 items-center justify-end rounded bg-[#20344e] px-2 text-white"
                          style={{
                            width: `${(day.consultas / Math.max(...d.porDia.map((x) => x.consultas))) * 100}%`,
                          }}
                        >
                          {day.consultas}
                        </div>
                      </div>
                      <span className="col-start-2 sm:col-auto sm:text-right">
                        {usd(day.costoUSD)}
                        {day.sinCosto ? " (parcial)" : ""}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
            <Card className="overflow-hidden">
              <div className="p-5">
                <h2 className="font-semibold">Actividad reciente</h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Hasta 50 consultas del filtro. Se guardan métricas, no preguntas ni respuestas.
                </p>
              </div>
              <TablaAdaptable className="w-full text-sm">
                <thead className="bg-muted">
                  <tr>
                    {[
                      "Fecha (Lima)",
                      "Usuario",
                      "Perfil",
                      "Resultado",
                      "Llamadas",
                      "Tokens",
                      "Costo estimado USD",
                    ].map((h) => (
                      <th key={h} className="p-3 text-left text-xs">
                        {h}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {d.recientes.length ? (
                    d.recientes.map((r) => (
                      <tr key={r.id} className="border-t">
                        <td className="p-3 text-xs">{fecha(r.fecha)}</td>
                        <td className="p-3">{r.usuario}</td>
                        <td className="p-3 text-xs">
                          {r.rol === "admin" ? "Admin" : r.canal.toUpperCase()}
                        </td>
                        <td className="p-3 text-xs">{estado[r.estado]}</td>
                        <td className="p-3">{r.llamadas}</td>
                        <td className="p-3">{num(r.entrada + r.salida)}</td>
                        <td className="p-3">
                          <span>
                            {usd(r.costoUSD)}
                            {r.sinCosto ? " + sin confirmar" : ""}
                          </span>
                          <span className="mt-1 block break-all text-[10px] text-muted-foreground">
                            {r.modelos}
                          </span>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan={7} className="p-6 text-center text-muted-foreground">
                        Sin consultas registradas.
                      </td>
                    </tr>
                  )}
                </tbody>
              </TablaAdaptable>
            </Card>
            <p className="text-xs leading-relaxed text-muted-foreground">
              Tarifa estándar de {d.tarifa.modelo}, verificada el {d.tarifa.verificada}: entrada US${" "}
              {d.tarifa.entrada.toFixed(2)}, entrada en caché US$ {d.tarifa.cache.toFixed(2)} y
              salida US$ {d.tarifa.salida.toFixed(2)} por millón de tokens. La caché ya está
              incluida en los tokens de entrada. Modelos o modalidades sin tarifa conocida se
              muestran sin costo confirmado.{" "}
              <a href={d.tarifa.url} target="_blank" rel="noreferrer" className="underline">
                Fuente oficial
              </a>
              . Última consulta: {fecha(d.consultadoEn)}.
            </p>
          </>
        )
      )}
    </Pagina>
  );
}
