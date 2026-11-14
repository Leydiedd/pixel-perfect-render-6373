import { createFileRoute } from "@tanstack/react-router";
export const Route=createFileRoute("/api/calidad-datos")({server:{handlers:{GET:async({request})=>{const {experienciaApi}=await import("@/lib/order-experience.server");return experienciaApi(request,"quality");}}}});
