import { useState } from "react";
import { X } from "lucide-react";
import logoWhatsAppAsset from "@/assets/bimbo-whatsapp.png.asset.json";

const ENLACE_WHATSAPP =
  "https://api.whatsapp.com/send?phone=51974119421&text=Hola%20Bimbo%20Osito,%20necesito%20realizar%20una%20consulta%20sobre%20mi%20pedido%20mayorista&type=phone_number&absent=0";

export function WidgetWhatsApp() {
  const [burbujaVisible, setBurbujaVisible] = useState(true);

  return (
    <div className="fixed bottom-6 right-6 z-50 flex items-end gap-3">
      {burbujaVisible ? (
        <div className="relative max-w-56 rounded-2xl rounded-br-sm border border-border bg-card px-4 py-3 shadow-card-hover">
          <button
            type="button"
            onClick={() => setBurbujaVisible(false)}
            aria-label="Cerrar mensaje"
            className="absolute -right-2 -top-2 rounded-full border border-border bg-background p-0.5 text-muted-foreground transition-colors hover:text-foreground"
          >
            <X className="size-3.5" />
          </button>
          <p className="text-sm font-medium text-foreground">¿En qué podemos ayudarte hoy?</p>
        </div>
      ) : null}
      <a
        href={ENLACE_WHATSAPP}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Contactar por WhatsApp"
        className="block size-14 overflow-hidden rounded-full shadow-card-hover transition-transform hover:scale-105"
      >
        <img
          src={logoWhatsAppAsset.url}
          alt="Contactar por WhatsApp"
          className="size-full object-cover"
        />
      </a>
    </div>
  );
}
