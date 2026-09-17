import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  esbuild: { jsx: "automatic" },
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@": path.resolve(import.meta.dirname, "client", "src"),
    },
  },
  test: {
    include: [
      "server/__tests__/**/*.test.ts",
      "server/sourceHunter/__tests__/**/*.test.ts",
      "client/src/__tests__/**/*.test.tsx",
    ],
    environment: "node",
    globals: false,
    // The Wikisource discovery tests honour the registry's 1 request/second
    // throttle and legitimately sleep ~3 s; under parallel load on a small
    // CI runner that brushes the 5 s default and flakes.
    testTimeout: 20_000,
  },
});
