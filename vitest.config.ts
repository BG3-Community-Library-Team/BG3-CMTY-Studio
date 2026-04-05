import { defineConfig } from "vitest/config";
import { svelte } from "@sveltejs/vite-plugin-svelte";

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
        functions: 48,
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
      "@tauri-apps/api/core": new URL("./src/__mocks__/tauri-api.ts", import.meta.url).pathname.slice(1),
      "@tauri-apps/api/event": new URL("./src/__mocks__/tauri-event.ts", import.meta.url).pathname.slice(1),
      "@tauri-apps/plugin-dialog": new URL("./src/__mocks__/tauri-plugin.ts", import.meta.url).pathname.slice(1),
      "@tauri-apps/plugin-shell": new URL("./src/__mocks__/tauri-plugin.ts", import.meta.url).pathname.slice(1),
    },
  },
});
