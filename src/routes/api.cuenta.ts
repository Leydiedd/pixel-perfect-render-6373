import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/cuenta")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { tiendaApi } = await import("@/lib/store.server");
        return tiendaApi(request, "account");
      },
    },
  },
});
