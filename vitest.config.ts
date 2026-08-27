import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts", "tests/**/*.test.tsx"],
    exclude: ["tests/e2e/**"],
    globals: false,
  },
  resolve: {
    alias: {
      "@": resolve(here, "src"),
      "server-only": resolve(here, "tests/shims/server-only.ts"),
    },
  },
});
