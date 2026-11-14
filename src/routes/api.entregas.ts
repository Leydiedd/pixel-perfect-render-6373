import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/entregas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { confirmarEntrega } = await import("@/lib/delivery.server");
        return confirmarEntrega(request);
      },
    },
  },
});
