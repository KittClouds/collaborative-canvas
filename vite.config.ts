import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    headers: {
      "Cross-Origin-Opener-Policy": "same-origin",
      "Cross-Origin-Embedder-Policy": "require-corp",
    },
  },
  plugins: [react(), mode === "development" && componentTagger()].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  optimizeDeps: {
    exclude: ["@sqliteai/sqlite-wasm"],
  },
  worker: {
    format: "es",
  },
  build: {
    target: "esnext",
  },
  test: {
    setupFiles: ['./src/test/vitest.setup.ts'],
    environment: 'node',
    alias: {
      'cozo-lib-wasm': path.resolve(__dirname, './src/test/__mocks__/cozo-lib-wasm.ts'),
    },
    deps: {
      inline: ['cozo-lib-wasm'],
    },
  },
}));
