import { createFileRoute } from "@tanstack/react-router";
import { useState } from "react";
import { Download, Mail, MessageCircle, Phone, Send } from "lucide-react";
import { toast } from "sonner";
import {
  cuenta,
  documentos,
  formatoFecha,
  formatoMoneda,
  ordenesActivas,
  preguntas,
  productos,
} from "@/data/catalogo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

export const Route = createFileRoute("/soporte")({
  head: () => ({
    meta: [
      { title: "Soporte y facturación — Bimbo Mayorista" },
      {
        name: "description",
        content:
          "Facturas, notas de crédito, chat con el ejecutivo de cuenta y respuestas sobre pedidos mínimos y entregas.",
      },
      { property: "og:title", content: "Soporte y facturación — Bimbo Mayorista" },
      {
        property: "og:description",
        content: "Centro de ayuda para clientes mayoristas: documentos, contacto y preguntas frecuentes.",
      },
       { property: "og:type", content: "website" },
       { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Soporte,
});

const estadoClase: Record<string, string> = {
  Pagada: "bg-success/15 text-success",
  Pendiente: "bg-warning/20 text-warning-foreground",
  Aplicada: "bg-navy-soft text-foreground",
};

function normalizar(t: string) {
  return t.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

function responder(entrada: string): string {
  const t = normalizar(entrada);
  const tiene = (...p: string[]) => p.some((x) => t.includes(x));

  const producto = productos.find((p) =>
    normalizar(p.nombre)
      .split(" ")
      .filter((w) => w.length > 3 && w !== "bimbo")
      .some((w) => t.includes(w)),
  );

  if (tiene("hola", "buenas", "buenos")) {
    return "¡Hola! Puedo ayudarte con precios, stock, pedido mínimo, entregas, facturas o tu línea de crédito. ¿Qué necesitas?";
  }
  if (producto && tiene("precio", "cuesta", "vale", "costo")) {
    const tramos = producto.precios
      .map((e) => `${formatoMoneda(e.precio)} desde ${e.desdePlanchas} planchas`)
      .join(", ");
    return `${producto.nombre}: ${tramos}.`;
  }
  if (producto && tiene("stock", "hay", "disponible", "queda")) {
    return `${producto.nombre} tiene ${producto.stockPlanchas} planchas en planta (${producto.unidadesPorPlancha} unidades por plancha).`;
  }
  if (producto) {
    return `${producto.nombre}: stock ${producto.stockPlanchas} planchas, mínimo ${producto.minimoPlanchas} planchas, desde ${formatoMoneda(producto.precios[0]?.precio ?? 0)} por plancha.`;
  }
  if (tiene("producto", "catalogo", "venden", "tienen")) {
    return `Actualmente ofrecemos: ${productos.map((p) => p.nombre).join("; ")}.`;
  }
  if (tiene("minimo")) return preguntas[0]!.respuesta;
  if (tiene("precio", "descuento", "volumen")) return preguntas[1]!.respuesta;
  if (tiene("caduc", "lote", "vencim")) return preguntas[2]!.respuesta;
  if (tiene("credito", "linea")) {
    const disp = cuenta.lineaCredito - cuenta.creditoUsado;
    return `Tu línea de crédito es ${formatoMoneda(cuenta.lineaCredito)}; tienes ${formatoMoneda(disp)} disponibles. ${preguntas[3]!.respuesta}`;
  }
  if (tiene("factura", "pago", "deuda", "pendiente")) {
    const pend = documentos.filter((d) => d.estado === "Pendiente");
    return pend.length
      ? `Tienes ${pend.length} factura(s) pendiente(s): ${pend.map((d) => `${d.numero} por ${formatoMoneda(d.monto)}`).join(", ")}.`
      : "No tienes facturas pendientes.";
  }
  if (tiene("pedido", "orden", "entrega", "llega", "envio", "despacho")) {
    return ordenesActivas
      .map((o) => `${o.folio}: ${o.estado}, entrega ${formatoFecha(o.entrega)}`)
      .join(" · ");
  }
  if (tiene("horario", "atienden", "contacto", "telefono", "correo")) {
    return `Atendemos ${cuenta.ejecutivo.horario}. Teléfono ${cuenta.ejecutivo.telefono}, correo ${cuenta.ejecutivo.correo}.`;
  }
  if (tiene("gracias")) return "¡Con gusto! Si necesitas algo más, aquí estoy.";
  if (tiene("adios", "chau", "hasta luego")) return "¡Hasta pronto! Buen día de ventas.";
  return "No estoy seguro de entenderte. Puedes preguntarme por precios, stock de un producto, pedido mínimo, estado de tus pedidos, facturas o crédito.";
}

function Soporte() {
   const [mensajes, setMensajes] = useState<{ de: "ejecutivo" | "cliente"; texto: string }[]>([
    {
      de: "ejecutivo" as const,
      texto: `Hola, soy ${cuenta.ejecutivo.nombre}. ¿En qué puedo ayudarte con tu abastecimiento?`,
    },
  ]);
  const [borrador, setBorrador] = useState("");

  const enviar = () => {
    const texto = borrador.trim();
    if (!texto) return;
    setMensajes((prev) => [...prev, { de: "cliente", texto }]);
    setBorrador("");
    const respuesta = responder(texto);
    setTimeout(() => {
      setMensajes((prev) => [...prev, { de: "ejecutivo", texto: respuesta }]);
    }, 700);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <h1 className="text-3xl font-semibold tracking-tight text-foreground">
        Soporte y facturación
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[1.5fr_1fr] lg:items-start">
        <div className="space-y-8">
          <Card className="overflow-hidden p-0">
            <div className="border-b border-border px-6 py-4">
              <h2 className="text-sm font-semibold text-foreground">Facturas y notas de crédito</h2>
            </div>
            <table className="w-full text-sm">
              <thead className="bg-navy-soft text-left text-xs uppercase tracking-wide text-muted-foreground">
                <tr>
                  <th className="px-6 py-3 font-medium">Documento</th>
                  <th className="px-3 py-3 font-medium">Tipo</th>
                  <th className="px-3 py-3 font-medium">Fecha</th>
                  <th className="px-3 py-3 font-medium">Monto</th>
                  <th className="px-3 py-3 font-medium">Estado</th>
                  <th className="px-6 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {documentos.map((doc) => (
                  <tr key={doc.numero}>
                    <td className="px-6 py-4 font-mono text-xs text-foreground">{doc.numero}</td>
                    <td className="px-3 py-4 text-muted-foreground">{doc.tipo}</td>
                    <td className="px-3 py-4 text-muted-foreground">{formatoFecha(doc.fecha)}</td>
                    <td className="px-3 py-4 font-medium text-foreground">{formatoMoneda(doc.monto)}</td>
                    <td className="px-3 py-4">
                      <span
                        className={`rounded-full px-2.5 py-1 text-xs font-medium ${estadoClase[doc.estado]}`}
                      >
                        {doc.estado}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => toast.success(`Descargando ${doc.numero}`)}
                      >
                        <Download className="size-4" aria-hidden />
                        Descargar
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>

          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground">Preguntas frecuentes</h2>
            <Accordion type="single" collapsible className="mt-2">
              {preguntas.map((p) => (
                <AccordionItem key={p.pregunta} value={p.pregunta}>
                  <AccordionTrigger className="text-left text-sm">{p.pregunta}</AccordionTrigger>
                  <AccordionContent className="text-sm text-muted-foreground">
                    {p.respuesta}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>

        <div className="space-y-6">
          <Card className="p-6">
            <h2 className="text-sm font-semibold text-foreground">Ejecutivo de cuenta asignado</h2>
            <p className="mt-3 text-base font-semibold text-foreground">{cuenta.ejecutivo.nombre}</p>
            <p className="text-xs text-muted-foreground">{cuenta.ejecutivo.cargo}</p>
            <ul className="mt-4 space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Phone className="size-4" aria-hidden />
                {cuenta.ejecutivo.telefono}
              </li>
              <li className="flex items-center gap-2">
                <Mail className="size-4" aria-hidden />
                {cuenta.ejecutivo.correo}
              </li>
            </ul>
            <p className="mt-3 text-xs text-muted-foreground">{cuenta.ejecutivo.horario}</p>
          </Card>

          <Card className="flex flex-col p-6">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-foreground">
              <MessageCircle className="size-4 text-primary" aria-hidden />
              Chat directo
            </h2>
            <div className="mt-4 flex max-h-72 flex-1 flex-col gap-3 overflow-y-auto">
              {mensajes.map((m, i) => (
                <p
                  key={`${m.de}-${i}`}
                  className={
                    m.de === "cliente"
                      ? "ml-auto max-w-[85%] rounded-xl bg-primary px-3 py-2 text-sm text-primary-foreground"
                      : "mr-auto max-w-[85%] rounded-xl bg-muted px-3 py-2 text-sm text-foreground"
                  }
                >
                  {m.texto}
                </p>
              ))}
            </div>
            <div className="mt-4 flex gap-2">
              <Input
                value={borrador}
                onChange={(e) => setBorrador(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") enviar();
                }}
                placeholder="Escribe tu consulta"
                aria-label="Mensaje para el ejecutivo de cuenta"
              />
              <Button onClick={enviar} aria-label="Enviar mensaje">
                <Send className="size-4" aria-hidden />
              </Button>
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}
