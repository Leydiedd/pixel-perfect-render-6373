import { useState } from "react";
import { Package } from "lucide-react";
import { cn } from "@/lib/utils";

export function ProductoImagen({
  src,
  alt,
  className,
  compact = false,
}: {
  src: string | null;
  alt: string;
  className?: string;
  compact?: boolean;
}) {
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <div
        role="img"
        aria-label={`${alt}: foto no disponible`}
        className={cn(
          "flex flex-col items-center justify-center gap-2 rounded-xl bg-slate-50 p-4 text-center text-xs text-muted-foreground",
          compact && "gap-0 p-1",
          className,
        )}
      >
        <Package className={cn("size-9 text-slate-400", compact && "size-6")} aria-hidden="true" />
        {!compact && <span>Foto por completar</span>}
      </div>
    );
  }
  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      decoding="async"
      onError={() => setFailedSrc(src)}
      className={cn("rounded-xl bg-white object-contain p-3", compact && "p-1", className)}
    />
  );
}
