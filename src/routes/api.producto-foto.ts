import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/producto-foto")({server:{handlers:{GET:async({request})=>{const {experienciaApi}=await import("@/lib/order-experience.server");return experienciaApi(request,"product-photo");}}}});
