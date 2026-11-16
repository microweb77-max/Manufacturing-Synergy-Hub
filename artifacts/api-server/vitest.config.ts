import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    // Integration tests share one database; run files serially.
    fileParallelism: false,
    testTimeout: 20_000,
    env: { LOG_LEVEL: "silent" },
  },
});
