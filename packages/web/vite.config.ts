import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import vike from "vike/plugin";
import react from "@vitejs/plugin-react";

const __dirname = fileURLToPath(new URL(".", import.meta.url));

export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        "@": __dirname,
      },
    },
    plugins: [
      react(),
      vike({}),
      cloudflare({ persistState: { path: "../../.wrangler/state" } }),
    ],
  };
});
