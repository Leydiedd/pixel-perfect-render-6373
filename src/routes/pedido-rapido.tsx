import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/pedido-rapido")({ beforeLoad: () => { throw redirect({ to: "/admin/pedido-rapido" }); } });
