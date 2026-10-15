import path from "node:path";
import { defineConfig } from "vitest/config";

// Unit tests for the pure logic in lib/ (the Playwright e2e specs live in tests/e2e).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["lib/**/*.test.ts"],
  },
});
