import { defineConfig } from "@lovable.dev/vite-tanstack-config";

export default defineConfig({
  // Local Dolibarr requires a Node server with access to PHP and the local config.
  nitro: { preset: "node-server" },
  vite: {
    server: {
      host: "127.0.0.1",
      port: 5173,
      strictPort: true,
      fs: { deny: [".env", ".env.*", "*.{crt,pem}", "**/.git/**", "**/.local/**", "**/server/**"] },
    },
    preview: { host: "127.0.0.1" },
  },
  tanstackStart: { server: { entry: "server" } },
});
