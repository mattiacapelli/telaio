import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["test/**/*.test.ts"],
    testTimeout: 30_000,
    hookTimeout: 60_000,
    // Ogni file usa il proprio database temporaneo, ma i file non si parlano: niente parallelismo necessario.
    fileParallelism: false,
  },
});
