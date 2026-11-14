import { ComentarioReporte } from "@/components/ComentarioReporte";
import { GraficoRanking } from "@/components/GraficoRanking";
import type { DatosDolibarr } from "@/lib/dolibarr-model";
import type { FiltrosReporte } from "@/lib/report-details";

import { rankingClientesPorCanal } from "@/lib/customer-ranking";
import { Card } from "@/components/ui/card";
import { Vacio } from "@/components/DatosReales";

export function DashboardClientes({
  datos,
  filtros,
}: {
  datos: DatosDolibarr;
  filtros: FiltrosReporte;
}) {
  const canales = rankingClientesPorCanal(datos, filtros);
  if (!canales.length)
    return (
      <Vacio>Selecciona B2B, B2C o todas las ventas para consultar los rankings de clientes.</Vacio>
    );
  return (
    <section className="space-y-4" aria-label="Clientes que más compraron por canal">
      <div>
        <h2 className="text-lg font-semibold">Clientes que más compraron</h2>
        <p className="text-sm text-muted-foreground">
          Top 10 de cada canal por importe neto comprado, sin IGV. Según los filtros de fecha y
          canal.
        </p>
      </div>
      <div className={`grid gap-5 ${canales.length > 1 ? "xl:grid-cols-2" : ""}`}>
        {canales.map((grupo) => {
          const color = grupo.canal === "b2c" ? "#d2182a" : "#203750";
          const titulo = grupo.canal === "b2c" ? "B2C · Clientes hogar" : "B2B · Clientes negocio";
          return (
            <Card
              key={grupo.canal}
              className="min-w-0 gap-5 border-t-4 p-4 sm:p-6"
              style={{ borderTopColor: color }}
            >
              <div>
                <h3 className="text-base font-semibold">{titulo}</h3>
                <p className="mt-1 text-xs text-muted-foreground">
                  {grupo.clientesConVentas.toLocaleString("es-PE")} clientes con compras netas
                  positivas · se muestran hasta 10.
                </p>
              </div>
              {grupo.ranking.length ? (
                <GraficoRanking
                  titulo={`Top 10 ${titulo} por importe comprado`}
                  moneda={datos.empresa.moneda}
                  color={color}
                  datos={grupo.ranking.map((cliente) => ({
                    id: String(cliente.id),
                    nombre: cliente.nombre,
                    importe: cliente.ventas,
                    detalle: `ID ${cliente.id} · ${cliente.compras.toLocaleString("es-PE")} compras`,
                  }))}
                />
              ) : (
                <Vacio>No hay clientes con compras netas positivas en este canal y período.</Vacio>
              )}
              <p className="mt-auto border-t pt-3 text-xs text-muted-foreground">
                Las barras usan la escala de este canal; compara los importes para contrastar B2B y
                B2C.
                {grupo.sinCliente > 0 &&
                  ` ${grupo.sinCliente} documentos sin cliente identificado quedan fuera del ranking.`}
              </p>
              <ComentarioReporte
                titulo={`Clientes que más compraron: ${titulo}`}
                datos={grupo}
                nota={
                  "Top 10 por importe neto sin IGV. Escalas independientes por canal; las notas de crédito reducen ventas pero no cuentan como compras."
                }
              />
            </Card>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Las notas de crédito reducen el importe comprado, pero no cuentan como compras. Se excluyen
        borradores, anuladas y proformas. Se agrupa por ID de cliente y canal de la factura. La
        tabla inferior mantiene el detalle completo; su buscador solo filtra la tabla.
      </p>
    </section>
  );
}
