import { defineConfig } from "vite";
import { pages } from "vike-cloudflare";
import devServer from "@hono/vite-dev-server";
import adapter from "@hono/vite-dev-server/cloudflare";
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
      devServer({
        entry: "hono-entry.ts",
        adapter,
        exclude: [
          /^\/@.+$/,
          /.*\.(ts|tsx|vue)($|\?)/,
          /.*\.(s?css|less)($|\?)/,
          /^\/favicon\.ico$/,
          /.*\.(svg|png)($|\?)/,
          /^\/(public|assets|static)\/.+/,
          /^\/node_modules\/.*/,
        ],
        injectClientScript: false,
      }),
      react(),
      vike({}),
      pages({
        server: {
          kind: "hono",
          entry: "hono-entry.ts",
        },
      }),
    ],
  };
});
