import { defineConfig } from "vite";
import { installPhoton } from "@photonjs/runtime/vite";
import { cloudflare } from "@photonjs/cloudflare/vite";
import vike from "vike/plugin";
import react from "@vitejs/plugin-react";

export default defineConfig(() => {
  return {
    resolve: {
      alias: {
        "@": process.cwd(),
      },
    },
    plugins: [
      react(),
      vike({}),
      installPhoton({
        server: "server/index.ts",
      }),
      cloudflare(),
    ],
  };
});
