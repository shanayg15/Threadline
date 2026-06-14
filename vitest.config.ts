import { fileURLToPath } from "node:url";

import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
  },
  resolve: {
    // Match the "@/*" -> "src/*" tsconfig path alias.
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
});
