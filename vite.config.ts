import { defineConfig } from "vite";
import { svelte } from "@sveltejs/vite-plugin-svelte";
import tailwindcss from "@tailwindcss/vite";
import { paraglideVitePlugin } from "@inlang/paraglide-js";
import { visualizer } from "rollup-plugin-visualizer";
import { writeFileSync, existsSync } from "node:fs";

declare const process: { env: Record<string, string | undefined> };

// Paraglide compiles .js with JSDoc types but no .d.ts.  This shim satisfies
// TypeScript strict mode (noImplicitAny) for `import { m } …` statements.
const PARAGLIDE_DTS = "src/paraglide/messages.d.ts";
const PARAGLIDE_DTS_CONTENT =
  "/* eslint-disable */\ntype MessageFn = (params?: Record<string, any>) => string;\nexport declare const m: Record<string, MessageFn>;\n";

function ensureParaglideTypes() {
  if (!existsSync(PARAGLIDE_DTS)) writeFileSync(PARAGLIDE_DTS, PARAGLIDE_DTS_CONTENT);
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    paraglideVitePlugin({
      project: "./project.inlang",
      outdir: "./src/paraglide",
    }),
    // Recreate .d.ts after Paraglide wipes the output directory on compile
    {
      name: "paraglide-types",
      buildEnd() { ensureParaglideTypes(); },
      configureServer() {
        // Initial creation after dev-mode compile; also re-check on HMR
        ensureParaglideTypes();
      },
      handleHotUpdate() { ensureParaglideTypes(); },
    },
    svelte(),
    tailwindcss(),
    ...(process.env.ANALYZE === "true"
      ? [visualizer({ open: true, filename: "stats.html", gzipSize: true })]
      : []),
  ],
  clearScreen: false,
  server: {
    host: "127.0.0.1",
    port: 1420,
    strictPort: true,
    watch: {
      ignored: [
        "**/src-tauri/**",
        "**/UnpackedData/**",
        "**/test_populated_dbs/**",
        "**/test_schema_dbs/**",
        "**/coverage/**",
        "**/dist/**",
      ],
    },
  },
  build: {
    // Tauri loads bundles from local disk — network transfer size is irrelevant.
    // The main chunk is all app code (Svelte components + utilities); vendors are
    // already split into yaml/icons/tauri chunks via manualChunks below.
    chunkSizeWarningLimit: 700,
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes("node_modules/@lucide/svelte")) return "icons";
          if (id.includes("node_modules/yaml")) return "yaml";
          if (
            id.includes("node_modules/@tauri-apps")
          )
            return "tauri";
        },
      },
    },
  },
});
