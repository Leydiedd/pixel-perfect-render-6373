import { useAvisoError } from "@/lib/ux-feedback";
import { useEffect, useRef, useState } from "react";
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "@tanstack/react-router";
import { Bell, Check, PackageCheck, CalendarDays } from "lucide-react";
import { toast } from "sonner";
import { Popover, PopoverTrigger, PopoverContent } from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { jsonApi, storeHeaders } from "@/context/tienda";
import { avisosSchema, textoAviso, type Aviso } from "@/lib/notifications-model";
export function NotificacionesCliente({ usuarioId }: { usuarioId: number }) {
  const [open, setOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  useAvisoError(error);
  const sending = useRef(false);
  const lastSeen = useRef<number | null>(null);
  const client = useQueryClient();
  const navigate = useNavigate();
  const q = useInfiniteQuery({
    queryKey: ["notificaciones", usuarioId],
    initialPageParam: null as number | null,
    queryFn: async ({ pageParam }) =>
      avisosSchema.parse(
        await jsonApi("/api/notificaciones" + (pageParam ? `?antes=${pageParam}` : "")),
      ),
    getNextPageParam: (last) => last.antes ?? undefined,
    refetchInterval: 15000,
    staleTime: 10000,
    retry: 1,
  });
  const first = q.data?.pages[0];
  const unread = first?.sinLeer ?? 0;
  const items = [
    ...new Map(
      (q.data?.pages.flatMap((p) => p.notificaciones) ?? []).map((n) => [n.id, n]),
    ).values(),
  ].sort((a, b) => b.id - a.id);
  useEffect(() => {
    if (!first) return;
    if (lastSeen.current !== null && first.ultimoId > lastSeen.current) {
      const fresh = first.notificaciones.filter((n) => !n.leida && n.id > lastSeen.current!);
      if (fresh.length) {
        const latest = textoAviso(fresh[0]!);
        toast.info(
          fresh.length === 1 ? latest.titulo : "Tienes nuevas notificaciones de tus pedidos",
          {
            id: `delivery-notification-${usuarioId}-${first.ultimoId}`,
            description:
              fresh.length === 1
                ? latest.mensaje
                : "Abre la campana para revisar las novedades de tus pedidos.",
            action: { label: "Ver avisos", onClick: () => setOpen(true) },
          },
        );
        void client.invalidateQueries({ queryKey: ["cuenta", usuarioId] });
      }
    }
    lastSeen.current = first.ultimoId;
  }, [first, client, usuarioId]);
  async function leer(data: { ids: number[] } | { hasta: number }, pedido?: Aviso) {
    if (sending.current) return;
    sending.current = true;
    setBusy(true);
    setError("");
    try {
      await jsonApi("/api/notificaciones", {
        method: "PATCH",
        headers: storeHeaders,
        body: JSON.stringify(data),
      });
      await client.invalidateQueries({ queryKey: ["notificaciones", usuarioId] });
      if (!pedido) toast.success("Notificaciones marcadas como leídas");
      if (pedido) {
        void client.invalidateQueries({ queryKey: ["cuenta", usuarioId] });
        setOpen(false);
        await navigate({ to: "/mi-cuenta", hash: `pedido-${pedido.pedidoId}` });
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }
  return (
    <Popover
      open={open}
      onOpenChange={(value) => {
        setOpen(value);
        if (value) void q.refetch();
      }}
    >
      <PopoverTrigger asChild>
        <button
          className="relative rounded-full p-2 hover:bg-slate-100 focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={
            q.isError ? "Notificaciones no disponibles" : `Notificaciones, ${unread} sin leer`
          }
        >
          <Bell className="size-5" aria-hidden="true" />
          {(unread > 0 || q.isError) && (
            <span className="absolute -right-1 -top-1 min-w-4 rounded-full bg-[#c52d36] px-1 text-center text-[10px] text-white">
              {q.isError ? "!" : unread > 99 ? "99+" : unread}
            </span>
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent
        align="end"
        className="w-[min(400px,calc(100vw-24px))] p-0"
        aria-label="Notificaciones de tus pedidos"
      >
        <div className="flex items-center justify-between gap-2 border-b p-4">
          <div>
            <h2 className="font-semibold">Tus notificaciones</h2>
            <p className="text-xs text-slate-500">
              {q.isError ? "No se pudo actualizar" : `${unread} sin leer`}
            </p>
          </div>
          {unread > 0 && first && (
            <Button
              size="sm"
              variant="ghost"
              disabled={busy}
              onClick={() => void leer({ hasta: first.ultimoId })}
            >
              Marcar todas leídas
            </Button>
          )}
        </div>
        {(q.isError || error) && (
          <div role="alert" className="space-y-2 p-4 text-sm text-red-800">
            <p>{error || "No se pudieron consultar tus avisos."}</p>
            <Button
              size="sm"
              variant="outline"
              onClick={() => {
                setError("");
                void q.refetch();
              }}
            >
              Reintentar
            </Button>
          </div>
        )}
        <div className="max-h-[min(460px,65vh)] overflow-y-auto">
          {q.isPending ? (
            <p className="p-5 text-sm">Consultando notificaciones…</p>
          ) : !items.length && !q.isError ? (
            <p className="p-5 text-sm text-slate-500">
              Te avisaremos cuando cambie una entrega, tu pedido esté listo para recoger o se
              confirme su recepción.
            </p>
          ) : (
            items.map((n) => {
              const text = textoAviso(n);
              const Icon = ["entregada", "retirado", "listo_recojo"].includes(n.tipo)
                ? PackageCheck
                : CalendarDays;
              return (
                <article
                  key={n.id}
                  className={`border-b p-4 ${n.leida ? "bg-white" : "bg-blue-50/70"}`}
                >
                  <div className="flex items-start gap-2">
                    <Icon className="mt-1 size-4 shrink-0" aria-hidden="true" />
                    <div className="min-w-0 flex-1">
                      <h3 className="text-sm font-semibold">
                        {text.titulo}
                        {!n.leida && (
                          <span className="ml-2 text-[10px] text-blue-700">Sin leer</span>
                        )}
                      </h3>
                      <p className="mt-1 text-sm leading-relaxed">{text.mensaje}</p>
                      <time className="mt-2 block text-xs text-slate-500" dateTime={n.creadaEn}>
                        {new Intl.DateTimeFormat("es-PE", {
                          dateStyle: "medium",
                          timeStyle: "short",
                          timeZone: "America/Lima",
                        }).format(new Date(n.creadaEn))}
                      </time>
                      <div className="mt-2 flex flex-wrap gap-2">
                        <Button
                          size="sm"
                          variant="outline"
                          disabled={busy}
                          onClick={() => void leer({ ids: [n.id] }, n)}
                        >
                          Ver pedido
                        </Button>
                        {!n.leida && (
                          <Button
                            size="sm"
                            variant="ghost"
                            disabled={busy}
                            onClick={() => void leer({ ids: [n.id] })}
                          >
                            <Check className="size-3" />
                            Marcar leída
                          </Button>
                        )}
                      </div>
                    </div>
                  </div>
                </article>
              );
            })
          )}
          {q.hasNextPage && (
            <div className="p-3 text-center">
              <Button
                variant="ghost"
                disabled={q.isFetchingNextPage}
                onClick={() => void q.fetchNextPage()}
              >
                {q.isFetchingNextPage ? "Cargando…" : "Cargar anteriores"}
              </Button>
            </div>
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}
