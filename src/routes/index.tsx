import { createFileRoute } from "@tanstack/react-router";
import { Tienda } from "@/components/Tienda";
export const Route = createFileRoute("/")({
  component: Tienda,
  head: () => ({ meta: [{ title: "Bimbo · Para tu hogar y tu negocio" }] }),
});
