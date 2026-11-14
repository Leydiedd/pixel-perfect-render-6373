import { useRef, useState, type ReactNode } from "react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogTrigger,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogCancel,
  AlertDialogAction,
} from "./ui/alert-dialog";
import { Button, type ButtonProps } from "./ui/button";
export function ConfirmarAccion({
  titulo,
  descripcion,
  confirmar = "Confirmar",
  onConfirm,
  children,
  ...props
}: Omit<ButtonProps, "onClick"> & {
  titulo: string;
  descripcion: string;
  confirmar?: string;
  onConfirm: () => void | Promise<void>;
  children: ReactNode;
}) {
  const [open, setOpen] = useState(false),
    [busy, setBusy] = useState(false);
  const sending = useRef(false);
  return (
    <AlertDialog
      open={open}
      onOpenChange={(v) => {
        if (!sending.current) setOpen(v);
      }}
    >
      <AlertDialogTrigger asChild>
        <Button type="button" {...props}>
          {children}
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{titulo}</AlertDialogTitle>
          <AlertDialogDescription>{descripcion}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={busy}>Volver</AlertDialogCancel>
          <AlertDialogAction
            disabled={busy}
            onClick={async (e) => {
              e.preventDefault();
              if (sending.current) return;
              sending.current = true;
              setBusy(true);
              try {
                await onConfirm();
                setOpen(false);
              } catch (err) {
                toast.error(err instanceof Error ? err.message : "No se pudo completar la acción.");
              } finally {
                sending.current = false;
                setBusy(false);
              }
            }}
          >
            {busy ? "Procesando…" : confirmar}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
