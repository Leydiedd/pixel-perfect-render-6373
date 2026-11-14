import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/boletas")({ beforeLoad: () => { throw redirect({ to: "/admin/boletas" }); } });
