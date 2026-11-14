import { createContext, useContext, useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Sparkles, LoaderCircle } from "lucide-react";
import { useSesion } from "@/context/tienda";
import { payloadComentario, solicitarComentario } from "@/lib/report-comment-client";
import { Button } from "./ui/button";

export const ContextoComentarios = createContext("");
export function ComentarioReporte({
  titulo,
  datos,
  nota = "",
  contextoExportacion,
}: {
  titulo: string;
  datos: unknown;
  nota?: string;
  contextoExportacion?: string;
}) {
  const contexto = useContext(ContextoComentarios);
  const sesion = useSesion();
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  const payload = payloadComentario(titulo, contextoExportacion ?? contexto, nota, datos);
  const current = useRef(payload);
  current.current = payload;
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const observer = new IntersectionObserver(([entry]) => setVisible(!!entry?.isIntersecting), {
      rootMargin: "80px",
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);
  const q = useQuery<{ texto: string; generadoEn: string }>({
    queryKey: ["comentario-reporte", sesion.data?.sesion?.id, payload],
    queryFn: ({ signal }) =>
      solicitarComentario(payload, signal, () => current.current === payload),
    enabled: visible && sesion.data?.sesion?.rol === "admin",
    staleTime: 30 * 60000,
    gcTime: 30 * 60000,
    retry: false,
    retryOnMount: false,
    refetchOnWindowFocus: false,
    refetchOnReconnect: false,
  });
  return (
    <div
      ref={ref}
      className="mt-4 rounded-xl border border-blue-100 bg-blue-50/60 p-4 text-sm text-slate-700"
      aria-label={`Explicación de ${titulo}`}
    >
      <div className="mb-2 flex items-center gap-2 font-semibold text-[#20344e]">
        <Sparkles className="size-4 shrink-0" />
        Comentario de la IA
      </div>
      <div aria-live="polite">
        {q.data ? (
          <p className="whitespace-pre-line leading-relaxed">{q.data.texto}</p>
        ) : q.isError ? (
          <>
            <p>{q.error.message}</p>
            <Button
              size="sm"
              variant="outline"
              className="mt-2"
              disabled={q.isFetching}
              onClick={() => void q.refetch()}
            >
              Reintentar explicación
            </Button>
          </>
        ) : (
          <p className="flex items-center gap-2 text-muted-foreground">
            <LoaderCircle className="size-4 animate-spin" />
            {q.isFetching
              ? "Preparando la explicación de estos datos…"
              : "La explicación se generará al ver este reporte."}
          </p>
        )}
      </div>
      {q.data && (
        <p className="mt-2 text-xs text-slate-500">
          Basado en los datos y filtros mostrados ·{" "}
          {new Date(q.data.generadoEn).toLocaleTimeString("es-PE", {
            hour: "2-digit",
            minute: "2-digit",
          })}
        </p>
      )}
    </div>
  );
}
