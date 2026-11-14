import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/entregas-previstas")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { programarEntrega } = await import("@/lib/delivery-plan.server");
        return programarEntrega(request);
      },
    },
  },
});
