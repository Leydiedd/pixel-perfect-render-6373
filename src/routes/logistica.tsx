import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/logistica")({ beforeLoad: () => { throw redirect({ to: "/admin/logistica" }); } });
