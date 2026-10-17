import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["tests/**/*.test.ts"],
    // i test leggono sempre data/seed.json, mai gli snapshot salvati in .data/
    env: { FILE_STORAGE: "off" },
  },
});
