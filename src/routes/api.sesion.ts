import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/sesion")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { manejarSesion } = await import("@/lib/auth.server");
        return manejarSesion(request);
      },
      POST: async ({ request }) => {
        const { manejarSesion } = await import("@/lib/auth.server");
        return manejarSesion(request);
      },
      DELETE: async ({ request }) => {
        const { manejarSesion } = await import("@/lib/auth.server");
        return manejarSesion(request);
      },
    },
  },
});
