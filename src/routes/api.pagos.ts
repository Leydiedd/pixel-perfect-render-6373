import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/pagos")({
  server: {
    handlers: {
      PATCH: async ({ request }) => {
        const { exigirAdmin } = await import("@/lib/auth.server");
        const denied = await exigirAdmin(request);
        if (denied) return denied;
        const { anularPago } = await import("@/lib/payment-void.server");
        return anularPago(request);
      },
      POST: async ({ request }) => {
        const { exigirAdmin } = await import("@/lib/auth.server");
        const denied = await exigirAdmin(request);
        if (denied) return denied;
        const { registrarPago } = await import("@/lib/payments.server");
        return registrarPago(request);
      },
    },
  },
});
