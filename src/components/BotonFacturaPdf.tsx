import { useState, type ReactNode } from "react";
import { Button } from "./ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "./ui/dialog";
import { VisorFacturaPdf } from "./VisorFacturaPdf";
export function BotonFacturaPdf({
  url,
  referencia,
  children = "Ver factura PDF",
}: {
  url: string;
  referencia: string;
  children?: ReactNode;
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button
        size="sm"
        variant="outline"
        onClick={() => setOpen(true)}
        className="max-w-full whitespace-normal text-left"
      >
        {children}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl min-w-0">
          <DialogHeader>
            <DialogTitle className="pr-6">{referencia}</DialogTitle>
            <DialogDescription>
              Consulta o descarga el documento en tu dispositivo.
            </DialogDescription>
          </DialogHeader>
          {open && <VisorFacturaPdf url={url} referencia={referencia} />}
        </DialogContent>
      </Dialog>
    </>
  );
}
