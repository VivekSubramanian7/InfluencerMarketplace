import { defineConfig } from "vitest/config";
import path from "node:path";

export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "."),
      "server-only": path.resolve(path.dirname(require.resolve("server-only")), "empty.js"),
    },
  },
  test: {
    include: ["**/__tests__/**/*.test.ts", "lib/notifications/**/*.test.ts"],
    environment: "node",
  },
});
