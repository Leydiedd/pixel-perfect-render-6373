import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/pedidos")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const { exigirAdmin } = await import("@/lib/auth.server");
        const denied = await exigirAdmin(request);
        if (denied) return denied;
        const { cancelarPedido } = await import("@/lib/orders.server");
        return cancelarPedido(request);
      },
      POST: async ({ request }) => {
        const { exigirAdmin } = await import("@/lib/auth.server");
        const denied = await exigirAdmin(request);
        if (denied) return denied;
        const { crearPedido } = await import("@/lib/orders.server");
        return crearPedido(request);
      },
    },
  },
});
