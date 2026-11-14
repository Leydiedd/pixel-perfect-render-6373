import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/notificaciones")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { notificacionesApi } = await import("@/lib/notifications.server");
        return notificacionesApi(request);
      },
      PATCH: async ({ request }) => {
        const { notificacionesApi } = await import("@/lib/notifications.server");
        return notificacionesApi(request);
      },
    },
  },
});
