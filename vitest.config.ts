import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    globalSetup: ["tests/preparar.ts"],
    // Las pruebas de base de datos comparten la misma base local: una detrás de otra
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
