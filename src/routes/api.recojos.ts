import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/recojos")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { registrarRecojo } = await import("@/lib/pickup.server");
        return registrarRecojo(request);
      },
    },
  },
});
