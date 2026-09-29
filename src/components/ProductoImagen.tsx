import { useState } from "react";
import { cn } from "@/lib/utils";

export function ProductoImagen({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [error, setError] = useState(false);

  if (error) {
    return (
      <div
        className={cn(
          "flex items-center justify-center bg-gradient-to-br from-muted to-navy-soft text-xs font-medium text-muted-foreground",
          className,
        )}
      >
        Foto no disponible
      </div>
    );
  }

  return (
    <img
      src={src}
      alt={alt}
      loading="lazy"
      onError={() => setError(true)}
      className={cn("object-cover", className)}
    />
  );
}
