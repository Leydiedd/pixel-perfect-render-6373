import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/estatus")({ beforeLoad: () => { throw redirect({ to: "/admin/estatus" }); } });
