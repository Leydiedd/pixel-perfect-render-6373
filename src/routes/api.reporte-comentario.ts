import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/reporte-comentario")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { comentarioReporteApi } = await import("@/lib/report-comment.server");
        return comentarioReporteApi(request);
      },
    },
  },
});
