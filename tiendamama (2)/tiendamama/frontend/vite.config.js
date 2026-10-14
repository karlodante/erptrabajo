import { defineConfig } from "vite";
import vue from "@vitejs/plugin-vue";
import { fileURLToPath, URL } from "node:url";

// https://vitejs.dev/config/
export default defineConfig({
  base: './', // Ruta relativa para funcionar con file:// protocolo en Electron
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    open: false,
    cors: true,
    proxy: {
      // Redirige /api → backend FastAPI
      "/api": {
        target:     "http://127.0.0.1:8765",
        changeOrigin: true,
        secure:     false,
      },
    },
  },
  css: {
    devSourcemap: true,
  },
  build: {
    target: "es2020",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      input: {
        main:   fileURLToPath(new URL("./index.html", import.meta.url)),
      },
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "pinia", "axios"],
          icons:  ["lucide-vue-next"],
        },
      },
    },
  },
});
