import * as path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      "@shared": path.resolve(import.meta.dirname, "shared"),
    },
  },
  test: {
    include: ["server/__tests__/**/*.test.ts", "server/sourceHunter/__tests__/**/*.test.ts"],
    environment: "node",
    globals: false,
  },
});
