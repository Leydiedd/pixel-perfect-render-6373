import { createFileRoute } from "@tanstack/react-router";
export const Route = createFileRoute("/api/pago-cliente")({
  server: {
    handlers: {
      POST: async ({ request }) => {
        const { pagarFacturaCliente } = await import("@/lib/customer-payment.server");
        return pagarFacturaCliente(request);
      },
    },
  },
});
