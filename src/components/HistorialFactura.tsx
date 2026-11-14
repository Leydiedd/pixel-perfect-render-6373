import { crearSolicitudId } from "@/lib/solicitud-id";
import { TablaAdaptable } from "@/components/TablaAdaptable";
import { useAvisoError } from "@/lib/ux-feedback";
import { toast } from "sonner";
import { nombrePago, nombreCuenta, referenciaPago } from "@/lib/payment-presentation";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useRef, useState } from "react";
import { useDolibarr } from "@/context/dolibarr";
import { anularPagoSchema, pagoAnuladoSchema, type AnularPago } from "@/lib/payment-void-model";
import { historialFacturaSchema } from "@/lib/invoice-history-model";
import { estadoFactura, formatoFecha, formatoMoneda } from "@/lib/dolibarr-model";
import { Estado, EnDolibarr } from "@/components/DatosReales";
import { Button } from "@/components/ui/button";
import { VisorFacturaPdf } from "@/components/VisorFacturaPdf";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";

export function HistorialFactura({
  facturaId,
  vista,
  cambiarVista,
  cerrar,
}: {
  facturaId: number | null;
  vista: "pagos" | "pdf";
  cambiarVista: (vista: "pagos" | "pdf") => void;
  cerrar: () => void;
}) {
  const { actualizar } = useDolibarr();
  const [seleccion, setSeleccion] = useState<number | null>(null);
  const [motivo, setMotivo] = useState("");
  const [pendiente, setPendiente] = useState<AnularPago | null>(null);
  const [recuperado, setRecuperado] = useState<number | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [errorAnular, setErrorAnular] = useState("");
  useAvisoError(errorAnular);
  const [aviso, setAviso] = useState("");
  const busy = useRef(false);
  const storageKey = "bimbo-dolibarr-anulacion-pago-v1";
  const id = pendiente?.facturaId ?? facturaId ?? recuperado;
  useEffect(() => {
    try {
      const raw = localStorage.getItem(storageKey);
      const saved = raw ? anularPagoSchema.safeParse(JSON.parse(raw)) : null;
      if (saved?.success) {
        setPendiente(saved.data);
        setRecuperado(saved.data.facturaId);
      }
    } catch {}
  }, []);
  useEffect(() => {
    setSeleccion(null);
    setMotivo("");
    setErrorAnular("");
    setAviso("");
  }, [facturaId]);
  const query = useQuery({
    queryKey: ["dolibarr", "historial", id],
    enabled: id !== null,
    queryFn: async ({ signal }) => {
      const response = await fetch(`/api/dolibarr?historial=${id}`, {
        signal,
        cache: "no-store",
      });
      if (!response.ok)
        throw new Error(
          response.status === 404
            ? "La factura ya no está disponible."
            : "No se pudo consultar el historial. Vuelve a intentar.",
        );
      return historialFacturaSchema.parse(await response.json());
    },
    staleTime: 0,
    refetchInterval: id === null ? false : 30_000,
    retry: 1,
  });
  const data = query.data;
  const factura = data?.factura;
  const pdfUrl = `/api/dolibarr?documento=${id}`;
  const dinero = (importe: number) => formatoMoneda(importe, factura?.moneda);
  const seleccionado = data?.pagos.find((p) => p.id === (pendiente?.pagoId ?? seleccion));
  function cerrarHistorial() {
    if (pendiente || enviando) return;
    setRecuperado(null);
    setSeleccion(null);
    setMotivo("");
    setErrorAnular("");
    setAviso("");
    cerrar();
  }
  async function confirmarAnulacion() {
    if (busy.current || !factura) return;
    const parsed = anularPagoSchema.safeParse(
      pendiente ?? {
        solicitudId: crearSolicitudId(),
        facturaId: factura.id,
        pagoId: seleccionado?.id,
        huella: seleccionado?.huella,
        saldoEsperado: factura.saldo,
        motivo,
      },
    );
    if (!parsed.success) {
      setErrorAnular(
        "Indica un motivo de 3 a 500 caracteres, sin saltos de línea ni símbolos < >.",
      );
      return;
    }
    busy.current = true;
    setEnviando(true);
    setErrorAnular("");
    setAviso("");
    try {
      localStorage.setItem(storageKey, JSON.stringify(parsed.data));
    } catch {
      busy.current = false;
      setEnviando(false);
      setErrorAnular(
        "No se pudo guardar la solicitud en este navegador. Habilita el almacenamiento local para continuar.",
      );
      return;
    }
    setPendiente(parsed.data);
    try {
      const response = await fetch("/api/pagos", {
        method: "PATCH",
        headers: { "Content-Type": "application/json", "X-Bimbo-Request": "order" },
        body: JSON.stringify(parsed.data),
      });
      const body = await response.json();
      if (!response.ok) {
        if (body.revisable === true) {
          localStorage.removeItem(storageKey);
          setPendiente(null);
          setSeleccion(null);
          actualizar();
          void query.refetch();
        }
        setErrorAnular(
          typeof body.error === "string"
            ? body.error
            : "No se pudo confirmar la anulación. Reintenta el mismo envío.",
        );
        return;
      }
      const result = pagoAnuladoSchema.parse(body);
      toast.success("Pago anulado", { description: "El saldo de la factura se recalculó." });
      localStorage.removeItem(storageKey);
      setPendiente(null);
      setSeleccion(null);
      setMotivo("");
      setAviso(
        `Pago ${result.pago.ref} anulado. Saldo pendiente: ${dinero(result.factura.saldo)}.${result.aviso ? ` ${result.aviso}` : ""}`,
      );
      actualizar();
      await query.refetch();
    } catch {
      setErrorAnular(
        "No se pudo confirmar la respuesta. Reintenta la misma anulación para recuperar el resultado.",
      );
    } finally {
      busy.current = false;
      setEnviando(false);
    }
  }
  return (
    <Dialog
      open={id !== null}
      onOpenChange={(open) => {
        if (!open) cerrarHistorial();
      }}
    >
      <DialogContent className="flex max-h-[92dvh] flex-col overflow-y-auto sm:max-w-5xl">
        <DialogHeader>
          <DialogTitle>{factura ? `Factura ${factura.ref}` : "Detalle de factura"}</DialogTitle>
          <DialogDescription>
            {factura?.cliente ?? "Consulta los pagos registrados y el documento de la factura."}
          </DialogDescription>
        </DialogHeader>
        {query.isPending && <p role="status">Cargando historial…</p>}
        {aviso && (
          <p
            role="status"
            className="rounded-md border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-950"
          >
            {aviso}
          </p>
        )}
        {errorAnular && (
          <p
            role="alert"
            className="rounded-md border border-red-300 bg-red-50 p-3 text-sm text-red-950"
          >
            {errorAnular}
          </p>
        )}
        {(seleccion !== null || pendiente) && (
          <div className="space-y-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-950">
            <h3 className="font-semibold">
              Anular pago {seleccionado?.ref ?? `#${pendiente?.pagoId}`}
            </h3>
            <p>
              Se retirará este cobro y su movimiento de cuenta en Dolibarr. El saldo pendiente de la
              factura aumentará por el importe anulado. Se conservará la constancia con el motivo.
              Esta acción no devuelve dinero al cliente.
            </p>
            {seleccionado && (
              <p>
                <strong>{dinero(seleccionado.importe)}</strong> ·{" "}
                {nombreCuenta(seleccionado.cuenta)}
              </p>
            )}
            <label className="block space-y-1">
              Motivo de anulación
              <input
                aria-label="Motivo de anulación del pago"
                className="h-10 w-full rounded-md border bg-background px-3 text-foreground"
                maxLength={500}
                value={pendiente?.motivo ?? motivo}
                disabled={!!pendiente || enviando}
                onChange={(e) => setMotivo(e.target.value)}
              />
            </label>
            {pendiente && (
              <p>
                Hay una anulación pendiente de confirmar. Reintenta el mismo envío para recuperar su
                resultado.
              </p>
            )}
            <div className="flex flex-wrap gap-2">
              <Button
                variant="destructive"
                disabled={enviando || !factura}
                onClick={() => void confirmarAnulacion()}
              >
                {enviando
                  ? "Anulando pago…"
                  : pendiente
                    ? "Reintentar anulación"
                    : "Confirmar anulación del pago"}
              </Button>
              {!pendiente && (
                <Button
                  variant="outline"
                  disabled={enviando}
                  onClick={() => {
                    setSeleccion(null);
                    setMotivo("");
                    setErrorAnular("");
                  }}
                >
                  Volver
                </Button>
              )}
            </div>
          </div>
        )}
        {query.isError && (
          <div
            role="alert"
            className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-950"
          >
            <p>{query.error.message}</p>
            {data && <p>Se muestra la última consulta correcta.</p>}
            <Button
              variant="outline"
              size="sm"
              onClick={() => void query.refetch()}
              disabled={query.isFetching}
            >
              Reintentar
            </Button>
          </div>
        )}
        {factura && data && (
          <>
            <div className="flex flex-wrap items-center gap-2">
              <Estado>{estadoFactura(factura)}</Estado>
              <Button
                size="sm"
                variant="ghost"
                onClick={() => void query.refetch()}
                disabled={query.isFetching}
              >
                {query.isFetching ? "Actualizando…" : "Actualizar historial"}
              </Button>
              {factura.pdf && (
                <Button size="sm" variant="outline" onClick={() => cambiarVista("pdf")}>
                  Ver documento PDF
                </Button>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 rounded-lg bg-muted/50 p-4 text-sm sm:grid-cols-4">
              {[
                ["Total factura", factura.total],
                ["Pagos registrados", factura.cobrado],
                ["Créditos aplicados", factura.creditos],
                ["Saldo pendiente", factura.saldo],
              ].map(([titulo, valor]) => (
                <div key={titulo}>
                  <p className="text-xs text-muted-foreground">{titulo}</p>
                  <p className="font-semibold">{dinero(Number(valor))}</p>
                </div>
              ))}
            </div>
            <Tabs value={vista} onValueChange={(value) => cambiarVista(value as "pagos" | "pdf")}>
              <TabsList aria-label="Detalle de factura">
                <TabsTrigger value="pagos">Historial de pagos ({data.pagos.length})</TabsTrigger>
                <TabsTrigger value="pdf">Ver PDF</TabsTrigger>
              </TabsList>
              <TabsContent value="pagos" className="overflow-x-auto">
                {data.pagos.length === 0 ? (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    Esta factura no tiene pagos vigentes registrados en Dolibarr.
                  </p>
                ) : (
                  <>
                    <p className="mb-3 text-xs text-muted-foreground">
                      Pagos registrados en esta factura, del más reciente al más antiguo.
                    </p>
                    <TablaAdaptable className="w-full text-left text-sm">
                      <thead className="bg-muted/50">
                        <tr>
                          {[
                            "Pago",
                            "Fecha",
                            "Importe aplicado",
                            "Método",
                            "Cuenta",
                            "Referencia de operación",
                            "Acciones",
                          ].map((h) => (
                            <th key={h} className="px-3 py-2">
                              {h}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody className="divide-y">
                        {data.pagos.map((pago) => (
                          <tr key={pago.id}>
                            <td className="px-3 py-3">
                              <span className="font-medium">{pago.ref}</span>
                            </td>
                            <td className="whitespace-nowrap px-3 py-3">
                              {formatoFecha(pago.fecha)}
                            </td>
                            <td className="whitespace-nowrap px-3 py-3 font-medium">
                              {dinero(pago.importe)}
                            </td>
                            <td className="px-3 py-3">
                              <p className="mb-1">{nombrePago(pago.medio)}</p>
                            </td>
                            <td className="px-3 py-3">{nombreCuenta(pago.cuenta)}</td>
                            <td className="max-w-48 break-words px-3 py-3">
                              {referenciaPago(pago.referencia)}
                            </td>
                            <td className="min-w-40 px-3 py-3">
                              {pago.anulable ? (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  disabled={!!pendiente || seleccion !== null || enviando}
                                  aria-label={`Anular pago ${pago.ref}`}
                                  onClick={() => {
                                    setSeleccion(pago.id);
                                    setMotivo("");
                                    setErrorAnular("");
                                    setAviso("");
                                  }}
                                >
                                  Anular pago
                                </Button>
                              ) : (
                                <span className="text-xs text-muted-foreground">
                                  {pago.bloqueo}
                                </span>
                              )}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </TablaAdaptable>
                  </>
                )}
                {data.anulados.length > 0 && (
                  <section className="mt-5 space-y-3 border-t pt-4" aria-label="Pagos anulados">
                    <h3 className="font-semibold">Pagos anulados</h3>
                    {data.anulados.map((p) => (
                      <div key={p.id} className="rounded-md border bg-muted/30 p-3 text-sm">
                        <p className="font-medium">
                          {p.ref} · {dinero(p.importe)} · Anulado
                        </p>
                        <p>
                          {formatoFecha(p.fecha)} · {p.usuario}
                        </p>
                        <p className="my-2">{nombrePago(p.medio) || "Método no registrado"}</p>
                        <p className="break-words">{p.motivo}</p>
                      </div>
                    ))}
                  </section>
                )}
              </TabsContent>
              <TabsContent value="pdf">
                {factura.pdf ? (
                  <VisorFacturaPdf key={factura.id} referencia={factura.ref} url={pdfUrl} />
                ) : (
                  <p className="py-8 text-center text-sm text-muted-foreground">
                    {factura.estado === 3
                      ? "El PDF de una factura anulada no se muestra como documento vigente."
                      : "Esta factura no tiene un PDF disponible. Puedes generarlo desde su ficha en Dolibarr."}
                  </p>
                )}
              </TabsContent>
            </Tabs>
            <div className="flex items-center justify-between gap-3 border-t pt-3">
              <EnDolibarr soloErp ruta={`compta/facture/card.php?facid=${factura.id}`}>
                Abrir gestión en Dolibarr
              </EnDolibarr>
              <Button
                variant="outline"
                onClick={cerrarHistorial}
                disabled={!!pendiente || enviando}
              >
                Cerrar
              </Button>
            </div>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
