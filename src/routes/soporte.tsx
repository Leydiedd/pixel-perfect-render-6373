import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/soporte")({ beforeLoad: () => { throw redirect({ to: "/admin/soporte" }); } });
