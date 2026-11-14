import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/chat-metricas")({
  server: {
    handlers: {
      GET: async ({ request }) => {
        const { metricasChatApi } = await import("@/lib/chat-metrics-api.server");
        return metricasChatApi(request);
      },
      POST: async ({ request }) => {
        const { metricasChatApi } = await import("@/lib/chat-metrics-api.server");
        return metricasChatApi(request);
      },
    },
  },
});
