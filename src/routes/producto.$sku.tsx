import { createFileRoute, redirect } from "@tanstack/react-router";
export const Route = createFileRoute("/producto/$sku")({ beforeLoad: ( { params } ) => { throw redirect({ to: "/admin/producto/$sku", params }); } });
