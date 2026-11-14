import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/admin-notificaciones")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { notificacionesAdminApi } = await import("@/lib/admin-notifications.server");
        return notificacionesAdminApi(request);
      },
      PATCH: async ({ request }) => {
        const { notificacionesAdminApi } = await import("@/lib/admin-notifications.server");
        return notificacionesAdminApi(request);
      },
    },
  },
});
