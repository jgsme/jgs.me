import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vikePhoton from "vike-photon/plugin";
import { cloudflare } from "@photonjs/cloudflare/vite";
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
      vikePhoton(),
      cloudflare({
        persistState: {
          path: "../../.wrangler/state",
        },
      }),
    ],
  };
});
