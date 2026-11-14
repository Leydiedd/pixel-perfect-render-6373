import { useEffect, useRef, useState } from "react";
import type { PDFDocumentProxy, PDFDocumentLoadingTask, RenderTask } from "pdfjs-dist";
import { Button } from "@/components/ui/button";

export function VisorFacturaPdf({ url, referencia }: { url: string; referencia: string }) {
  const [documento, setDocumento] = useState<PDFDocumentProxy | null>(null);
  const [pagina, setPagina] = useState(1);
  const [zoom, setZoom] = useState(1);
  const [ancho, setAncho] = useState(600);
  const [cargando, setCargando] = useState(true);
  const [dibujando, setDibujando] = useState(false);
  const [error, setError] = useState("");
  const [intento, setIntento] = useState(0);
  const canvas = useRef<HTMLCanvasElement>(null);
  const contenedor = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const element = contenedor.current;
    if (!element) return;
    const observer = new ResizeObserver(
      ([entry]) => entry && setAncho(Math.max(200, entry.contentRect.width - 24)),
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  useEffect(() => {
    let cerrado = false;
    let tarea: PDFDocumentLoadingTask | undefined;
    setDocumento(null);
    setPagina(1);
    setError("");
    setCargando(true);
    void (async () => {
      try {
        // Load the renderer only when a user opens the PDF tab, never during SSR.
        const [pdfjs, worker] = await Promise.all([
          import("pdfjs-dist"),
          import("pdfjs-dist/build/pdf.worker.min.mjs?url"),
        ]);
        if (cerrado) return;
        pdfjs.GlobalWorkerOptions.workerSrc = worker.default;
        tarea = pdfjs.getDocument({
          url,
          cMapUrl: "/pdfjs/cmaps/",
          cMapPacked: true,
          standardFontDataUrl: "/pdfjs/standard_fonts/",
          wasmUrl: "/pdfjs/wasm/",
        });
        const pdf = await tarea.promise;
        if (!cerrado) setDocumento(pdf);
      } catch {
        if (!cerrado)
          setError(
            "No se pudo abrir el PDF. Reintenta o descarga el documento para abrirlo en tu dispositivo.",
          );
      } finally {
        if (!cerrado) setCargando(false);
      }
    })();
    return () => {
      cerrado = true;
      if (tarea) void tarea.destroy();
    };
  }, [url, intento]);
  useEffect(() => {
    if (!documento || !canvas.current) return;
    let cerrado = false;
    let render: RenderTask | undefined;
    const target = canvas.current;
    setDibujando(true);
    setError("");
    void (async () => {
      try {
        const page = await documento.getPage(pagina);
        if (cerrado) return;
        const natural = page.getViewport({ scale: 1 });
        const viewport = page.getViewport({ scale: (ancho / natural.width) * zoom });
        const ratio = Math.min(window.devicePixelRatio || 1, 2);
        target.width = Math.floor(viewport.width * ratio);
        target.height = Math.floor(viewport.height * ratio);
        target.style.width = `${Math.floor(viewport.width)}px`;
        target.style.height = `${Math.floor(viewport.height)}px`;
        render = page.render({ canvas: target, viewport, transform: [ratio, 0, 0, ratio, 0, 0] });
        await render.promise;
      } catch {
        if (!cerrado) setError("No se pudo mostrar esta página del PDF.");
      } finally {
        if (!cerrado) setDibujando(false);
      }
    })();
    return () => {
      cerrado = true;
      render?.cancel();
    };
  }, [documento, pagina, zoom, ancho]);
  return (
    <div className="min-w-0 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
        <div className="flex flex-wrap items-center gap-2">
          <Button
            size="sm"
            variant="outline"
            disabled={!documento || pagina <= 1 || dibujando}
            onClick={() => setPagina((n) => n - 1)}
          >
            Página anterior
          </Button>
          <span aria-live="polite">
            {documento
              ? `Página ${pagina} de ${documento.numPages}`
              : error
                ? "PDF no disponible"
                : "Cargando PDF…"}
          </span>
          <Button
            size="sm"
            variant="outline"
            disabled={!documento || pagina >= documento.numPages || dibujando}
            onClick={() => setPagina((n) => n + 1)}
          >
            Página siguiente
          </Button>
        </div>
        <label className="flex items-center gap-2">
          Zoom
          <select
            aria-label="Zoom del PDF"
            className="rounded-md border bg-background p-2"
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
          >
            <option value={1}>Ajustar al ancho</option>
            <option value={1.25}>125 %</option>
            <option value={1.5}>150 %</option>
            <option value={2}>200 %</option>
          </select>
        </label>
        <Button variant="outline" size="sm" asChild>
          <a href={`${url}&descarga=1`} download={`${referencia}.pdf`}>
            Descargar PDF
          </a>
        </Button>
      </div>
      {error && (
        <div role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-950">
          <p>{error}</p>
          <Button variant="outline" size="sm" onClick={() => setIntento((n) => n + 1)}>
            Reintentar PDF
          </Button>
        </div>
      )}
      <div
        ref={contenedor}
        className="min-w-0 max-h-[52dvh] overflow-auto rounded-md border bg-slate-200 p-3"
        aria-busy={cargando || dibujando}
      >
        {(cargando || dibujando) && (
          <p role="status" className="py-2 text-center text-sm text-slate-700">
            Cargando documento…
          </p>
        )}
        <canvas
          ref={canvas}
          role="img"
          aria-label={`Factura ${referencia}, página ${pagina}`}
          className={cargando || error ? "hidden" : "mx-auto bg-white shadow-sm"}
        />
      </div>
    </div>
  );
}
