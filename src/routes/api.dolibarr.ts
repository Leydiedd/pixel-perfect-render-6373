import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/api/dolibarr")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { exigirAdmin } = await import("@/lib/auth.server");
        const denied = await exigirAdmin(request);
        if (denied) return denied;
        const { responderDolibarr } = await import("@/lib/dolibarr.server");
        return responderDolibarr(request);
      },
    },
  },
});
