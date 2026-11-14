import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/asistente")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { asistenteApi } = await import("@/lib/chat.server");
        return asistenteApi(request);
      },
      POST: async ({ request }) => {
        const { asistenteApi } = await import("@/lib/chat.server");
        return asistenteApi(request);
      },
    },
  },
});
