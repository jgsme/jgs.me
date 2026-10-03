import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    // workerd の起動と font の取得 (jsDelivr) があるので既定の 5s では足りない
    testTimeout: 60_000,
    hookTimeout: 120_000,
  },
});
