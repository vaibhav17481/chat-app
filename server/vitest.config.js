import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    setupFiles: ["./tests/setup.js"],
    // The suite talks to a single test database, so files run one after another.
    fileParallelism: false,
    testTimeout: 30000,
    hookTimeout: 30000,
  },
});
