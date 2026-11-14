import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/tienda")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { tiendaApi } = await import("@/lib/store.server");
        return tiendaApi(request, "catalog");
      },
    },
  },
});
