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
  },
});
