import { useState } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./ui/input";
import type { ComponentProps } from "react";
export function CampoContrasena(props: ComponentProps<typeof Input>) {
  const [visible, setVisible] = useState(false);
  return (
    <span className="relative block">
      <Input
        {...props}
        aria-label={props["aria-label"] || "Contraseña"}
        type={visible ? "text" : "password"}
        className={`pr-12 ${props.className || ""}`}
      />
      <button
        type="button"
        aria-label={visible ? "Ocultar contraseña" : "Mostrar contraseña"}
        aria-pressed={visible}
        onClick={() => setVisible(!visible)}
        className="absolute inset-y-0 right-0 grid w-11 place-items-center text-slate-500"
      >
        {visible ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
      </button>
    </span>
  );
}
