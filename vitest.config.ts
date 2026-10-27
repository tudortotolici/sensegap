import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["packages/*/test/**/*.test.ts", "collectors/*/test/**/*.test.ts"],
  },
});
