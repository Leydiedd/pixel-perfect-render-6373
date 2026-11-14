import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/registro")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { manejarSesion } = await import("@/lib/auth.server");
        return manejarSesion(request, true);
      },
    },
  },
});
