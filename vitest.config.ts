import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import { fileURLToPath } from "node:url";

export default defineConfig({
  plugins: [svelte()],
  test: {
    include: ["src/**/*.test.ts"],
    environment: "node",
    globals: false,
    setupFiles: ["src/__tests__/setup.ts"],
    testTimeout: 30_000,
    coverage: {
      provider: "v8",
      include: ["src/lib/**/*.ts", "src/lib/**/*.svelte.ts"],
      exclude: ["src/__mocks__/**", "src/__tests__/**"],
      reporter: ["text", "lcov"],
      thresholds: {
        statements: 51,
        branches: 46,
        functions: 47,
        lines: 52,
      },
    },
  },
  resolve: {
    // "browser" condition ensures Svelte resolves to client-side code (not SSR)
    // when jsdom environment is used for component tests
    conditions: ["browser"],
    alias: {
      // Stub Tauri APIs so tests can import modules that reference them
      "@tauri-apps/api/core": fileURLToPath(new URL("./src/__mocks__/tauri-api.ts", import.meta.url)),
      "@tauri-apps/api/event": fileURLToPath(new URL("./src/__mocks__/tauri-event.ts", import.meta.url)),
      "@tauri-apps/plugin-dialog": fileURLToPath(new URL("./src/__mocks__/tauri-plugin.ts", import.meta.url)),
      "@tauri-apps/plugin-shell": fileURLToPath(new URL("./src/__mocks__/tauri-plugin.ts", import.meta.url)),
    },
  },
});
