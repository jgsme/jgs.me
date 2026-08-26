import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // "cloudflare:workers" は workerd 組み込みモジュールで vitest からは解決できない。
      // 詳細は src/cloudflareWorkersStub.ts を参照。
      "cloudflare:workers": new URL(
        "./src/cloudflareWorkersStub.ts",
        import.meta.url,
      ).pathname,
    },
  },
  test: {
    include: ["src/**/*.test.ts"],
  },
});
