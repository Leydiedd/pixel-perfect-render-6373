import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/compra")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { tiendaApi } = await import("@/lib/store.server");
        return tiendaApi(request, "purchase");
      },
    },
  },
});
