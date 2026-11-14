import { BotonFacturaPdf } from "./BotonFacturaPdf";
import { esPdfPortal } from "@/lib/mobile-links";
import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Bot, MessageCircle, Send, Loader2, RotateCcw, ArrowUpRight } from "lucide-react";
import { Link } from "@tanstack/react-router";
import { jsonApi, storeHeaders } from "@/context/tienda";
import type { Sesion } from "@/lib/store-model";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "./ui/dialog";
type Message = {
  rol: "user" | "assistant";
  texto: string;
  fuentes?: { titulo: string; url: string }[];
  consultadoEn?: string;
  consultas?: string[];
};
export function AsistenteChat({
  usuario,
  admin = false,
  canal = "b2c",
  carrito = [],
}: {
  usuario: Sesion | null;
  admin?: boolean;
  canal?: "b2b" | "b2c";
  carrito?: { id: number; cantidad: number }[];
}) {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const abort = useRef<AbortController | null>(null);
  const scroll = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLTextAreaElement>(null);
  const status = useQuery<{ disponible: boolean; modelo?: string; limiteDiario?: number }>({
    queryKey: ["asistente", usuario?.id],
    queryFn: () => jsonApi("/api/asistente"),
    enabled: open && !!usuario,
    staleTime: 0,
    retry: false,
  });
  useEffect(() => () => abort.current?.abort(), []);
  useEffect(() => {
    scroll.current?.scrollTo({ top: scroll.current.scrollHeight, behavior: "smooth" });
  }, [messages, busy, error]);
  async function send(value = text) {
    const mensaje = value.trim();
    if (!mensaje || busy || !usuario || !status.data?.disponible) return;
    setText("");
    setError("");
    setBusy(true);
    const previous = messages;
    setMessages([...previous, { rol: "user", texto: mensaje }]);
    const controller = new AbortController();
    abort.current = controller;
    try {
      const r = await jsonApi("/api/asistente", {
        method: "POST",
        headers: storeHeaders,
        signal: controller.signal,
        body: JSON.stringify({
          mensaje,
          historial: previous.slice(-6).map((m) => ({ rol: m.rol, texto: m.texto.slice(0, 3000) })),
          canal,
          carrito,
        }),
      });
      setMessages((current) => [
        ...current,
        {
          rol: "assistant",
          texto: r.respuesta,
          fuentes: r.fuentes,
          consultadoEn: r.consultadoEn,
          consultas: r.consultas,
        },
      ]);
    } catch (e) {
      if (!controller.signal.aborted) {
        setMessages(previous);
        setText(mensaje);
        setError(e instanceof Error ? e.message : "No se pudo enviar la consulta.");
      }
    } finally {
      if (!controller.signal.aborted) {
        setBusy(false);
        input.current?.focus();
      }
    }
  }
  const suggestions = admin
    ? [
        "Resumen de ventas de este mes",
        "Busca al cliente CU2611-00001",
        "Productos más vendidos",
        "Facturas pendientes de pago",
      ]
    : [
        "¿Qué panes tienen disponibles?",
        ...(canal === "b2b" ? ["¿Cuánto me falta para el precio mayorista?"] : []),
        "¿Cómo van mis pedidos?",
        "¿Qué facturas tengo pendientes?",
      ];
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <button
          className="fixed bottom-[max(1rem,env(safe-area-inset-bottom))] right-4 z-40 flex min-h-12 items-center gap-2 rounded-full bg-[#20344e] px-4 py-3 text-sm font-semibold text-white shadow-xl ring-1 ring-white/30 transition hover:bg-[#304d70] focus-visible:outline-2 focus-visible:outline-offset-4 focus-visible:outline-blue-600"
          aria-label={admin ? "Abrir asistente de administración" : "Abrir asistente de la tienda"}
        >
          <MessageCircle className="size-5" />
          <span>Asistente</span>
        </button>
      </DialogTrigger>
      <DialogContent className="flex h-[min(700px,calc(100dvh-1.5rem))] flex-col gap-0 overflow-hidden rounded-2xl p-0 sm:p-0 sm:bottom-5 sm:left-auto sm:right-5 sm:top-auto sm:w-[440px] sm:max-w-[440px] sm:translate-x-0 sm:translate-y-0 [&>button]:text-white">
        <div className="bg-[#20344e] px-5 py-5 pr-12 text-white">
          <div className="mb-2 flex items-center gap-2">
            <Bot className="size-5" />
            <span className="text-[10px] font-bold uppercase tracking-[.18em] text-white/70">
              Bimbo · {admin ? "Administración" : "Tienda"}
            </span>
          </div>
          <DialogTitle className="text-xl text-white">Tu asistente de consultas</DialogTitle>
          <DialogDescription className="mt-1 text-xs text-white/80">
            {admin
              ? "Clientes, documentos y reportes a un mensaje."
              : "Productos y seguimiento de tus compras."}
          </DialogDescription>
        </div>
        <div
          ref={scroll}
          className="min-h-0 flex-1 space-y-4 overflow-y-auto overscroll-contain bg-slate-50 px-4 py-5"
          role="log"
          aria-label="Conversación con el asistente"
          aria-live="polite"
          aria-busy={busy}
        >
          {!messages.length && (
            <div className="space-y-4">
              <div className="rounded-2xl rounded-tl-sm border bg-white p-4 text-sm leading-relaxed text-slate-700">
                <p className="mb-1 font-semibold text-[#20344e]">
                  {admin ? "¿Qué necesitas revisar hoy?" : "Hola, ¿en qué te ayudo?"}
                </p>
                <p>
                  {admin
                    ? "Busca un cliente por su código, revisa una factura o consulta los indicadores de tu negocio."
                    : "Puedo consultar precios, disponibilidad y el estado de tus pedidos y facturas."}
                </p>
              </div>
              <div className="grid gap-2">
                {suggestions.map((s) => (
                  <button
                    key={s}
                    onClick={() => void send(s)}
                    disabled={!usuario || !status.data?.disponible || busy}
                    className="rounded-xl border border-slate-200 bg-white p-3 text-left text-xs text-[#20344e] hover:border-blue-400 disabled:opacity-50"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={
                m.rol === "user"
                  ? "ml-6 rounded-2xl rounded-tr-sm bg-[#20344e] p-3 text-sm text-white"
                  : "mr-2 rounded-2xl rounded-tl-sm border bg-white p-4 text-sm text-slate-800"
              }
            >
              <p className="whitespace-pre-wrap break-words leading-relaxed">{m.texto}</p>
              {!!m.fuentes?.length && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {m.fuentes.map((f) =>
                    esPdfPortal(f.url) ? (
                      <BotonFacturaPdf key={f.url} url={f.url} referencia={f.titulo}>
                        {f.titulo}
                      </BotonFacturaPdf>
                    ) : (
                      <a
                        key={f.url}
                        href={f.url}
                        onClick={() => setOpen(false)}
                        rel="noreferrer"
                        className="inline-flex max-w-full items-center gap-1 rounded-lg border px-2 py-1.5 text-xs text-blue-800 hover:bg-blue-50"
                      >
                        <span className="break-words">{f.titulo}</span>
                        <ArrowUpRight className="size-3 shrink-0" />
                      </a>
                    ),
                  )}
                </div>
              )}
              {m.consultadoEn && (
                <p className="mt-3 text-[10px] text-slate-500">
                  {m.consultas?.length ? "Dolibarr consultado" : "Respuesta del asistente"} ·{" "}
                  {new Date(m.consultadoEn).toLocaleTimeString("es-PE", {
                    hour: "2-digit",
                    minute: "2-digit",
                    timeZone: "America/Lima",
                  })}
                </p>
              )}
            </div>
          ))}
          {busy && (
            <p role="status" className="flex items-center gap-2 text-xs text-slate-600">
              <Loader2 className="size-4 animate-spin" />
              Consultando información…
            </p>
          )}
          {!usuario && (
            <div className="rounded-xl border border-blue-200 bg-blue-50 p-4 text-sm">
              <p>Inicia sesión para usar el asistente y consultar tus compras.</p>
              <Link
                to="/acceso"
                search={{ destino: admin ? "admin" : "cuenta" }}
                onClick={() => setOpen(false)}
                className="mt-2 inline-block font-semibold underline"
              >
                Iniciar sesión
              </Link>
            </div>
          )}
          {usuario && status.isPending && (
            <p className="text-xs text-slate-500">Comprobando disponibilidad…</p>
          )}
          {usuario && status.data && !status.data.disponible && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs leading-relaxed">
              <p>
                {admin
                  ? "Para habilitar el asistente, coloca OPENAI_API_KEY en .local/openai.env del servidor. La clave se lee automáticamente."
                  : "Estamos preparando el asistente. Mientras tanto, puedes consultar el catálogo y tu cuenta."}
              </p>
              {admin && (
                <Button
                  variant="outline"
                  size="sm"
                  className="mt-2"
                  onClick={() => void status.refetch()}
                >
                  Comprobar configuración
                </Button>
              )}
            </div>
          )}
          {(error || status.isError) && (
            <div
              role="alert"
              className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800"
            >
              {error || "No se pudo comprobar el asistente."}
              {status.isError && (
                <button onClick={() => void status.refetch()} className="ml-2 underline">
                  Reintentar
                </button>
              )}
            </div>
          )}
        </div>
        <form
          className="border-t bg-white p-4 pb-[max(1rem,env(safe-area-inset-bottom))]"
          onSubmit={(e) => {
            e.preventDefault();
            void send();
          }}
        >
          <label htmlFor="asistente-mensaje" className="sr-only">
            Tu consulta
          </label>
          <div className="flex items-end gap-2">
            <textarea
              ref={input}
              id="asistente-mensaje"
              value={text}
              onChange={(e) => setText(e.target.value)}
              maxLength={1000}
              rows={2}
              disabled={!usuario || !status.data?.disponible || busy}
              placeholder={admin ? "Ej.: facturas de CU2611-00001" : "Escribe tu consulta…"}
              className="min-w-0 flex-1 resize-none rounded-xl border border-slate-300 bg-white p-3 text-base text-slate-900 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50 sm:text-sm"
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                  e.preventDefault();
                  void send();
                }
              }}
            />
            <Button
              type="submit"
              aria-label="Enviar consulta"
              disabled={!text.trim() || busy || !usuario || !status.data?.disponible}
              className="h-11 w-11 shrink-0 rounded-xl bg-[#20344e] p-0"
            >
              {busy ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
            </Button>
          </div>
          <div className="mt-2 flex items-center justify-between gap-2 text-[10px] text-slate-500">
            <span>Consulta con IA · verifica en el documento</span>
            <button
              type="button"
              disabled={busy || !messages.length}
              onClick={() => {
                setMessages([]);
                setError("");
                setText("");
                input.current?.focus();
              }}
              className="flex items-center gap-1 rounded px-1 py-1 hover:text-slate-900 disabled:opacity-40"
            >
              <RotateCcw className="size-3" />
              Nueva conversación
            </button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
