import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";
import vike from "vike/plugin";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    vike({}),
    cloudflare({ persistState: { path: "../../.wrangler/state" } }),
  ],
});
