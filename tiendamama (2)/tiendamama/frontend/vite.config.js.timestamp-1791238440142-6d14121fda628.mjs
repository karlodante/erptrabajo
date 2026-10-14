// vite.config.js
import { defineConfig } from "file:///C:/Users/carlitos/Downloads/tiendamama%20(2)/tiendamama/frontend/node_modules/vite/dist/node/index.js";
import vue from "file:///C:/Users/carlitos/Downloads/tiendamama%20(2)/tiendamama/frontend/node_modules/@vitejs/plugin-vue/dist/index.mjs";
import { fileURLToPath, URL } from "node:url";
var __vite_injected_original_import_meta_url = "file:///C:/Users/carlitos/Downloads/tiendamama%20(2)/tiendamama/frontend/vite.config.js";
var vite_config_default = defineConfig({
  base: "./",
  // Ruta relativa para funcionar con file:// protocolo en Electron
  plugins: [vue()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", __vite_injected_original_import_meta_url))
    }
  },
  server: {
    host: "127.0.0.1",
    port: 5173,
    open: false,
    cors: true,
    proxy: {
      // Redirige /api → backend FastAPI
      "/api": {
        target: "http://127.0.0.1:8765",
        changeOrigin: true,
        secure: false
      }
    }
  },
  css: {
    devSourcemap: true
  },
  build: {
    target: "es2020",
    sourcemap: false,
    minify: "esbuild",
    rollupOptions: {
      input: {
        main: fileURLToPath(new URL("./index.html", __vite_injected_original_import_meta_url))
      },
      output: {
        manualChunks: {
          vendor: ["vue", "vue-router", "pinia", "axios"],
          icons: ["lucide-vue-next"]
        }
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcuanMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCJDOlxcXFxVc2Vyc1xcXFxjYXJsaXRvc1xcXFxEb3dubG9hZHNcXFxcdGllbmRhbWFtYSAoMilcXFxcdGllbmRhbWFtYVxcXFxmcm9udGVuZFwiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9maWxlbmFtZSA9IFwiQzpcXFxcVXNlcnNcXFxcY2FybGl0b3NcXFxcRG93bmxvYWRzXFxcXHRpZW5kYW1hbWEgKDIpXFxcXHRpZW5kYW1hbWFcXFxcZnJvbnRlbmRcXFxcdml0ZS5jb25maWcuanNcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfaW1wb3J0X21ldGFfdXJsID0gXCJmaWxlOi8vL0M6L1VzZXJzL2NhcmxpdG9zL0Rvd25sb2Fkcy90aWVuZGFtYW1hJTIwKDIpL3RpZW5kYW1hbWEvZnJvbnRlbmQvdml0ZS5jb25maWcuanNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xyXG5pbXBvcnQgdnVlIGZyb20gXCJAdml0ZWpzL3BsdWdpbi12dWVcIjtcclxuaW1wb3J0IHsgZmlsZVVSTFRvUGF0aCwgVVJMIH0gZnJvbSBcIm5vZGU6dXJsXCI7XHJcblxyXG4vLyBodHRwczovL3ZpdGVqcy5kZXYvY29uZmlnL1xyXG5leHBvcnQgZGVmYXVsdCBkZWZpbmVDb25maWcoe1xyXG4gIGJhc2U6ICcuLycsIC8vIFJ1dGEgcmVsYXRpdmEgcGFyYSBmdW5jaW9uYXIgY29uIGZpbGU6Ly8gcHJvdG9jb2xvIGVuIEVsZWN0cm9uXHJcbiAgcGx1Z2luczogW3Z1ZSgpXSxcclxuICByZXNvbHZlOiB7XHJcbiAgICBhbGlhczoge1xyXG4gICAgICBcIkBcIjogZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9zcmNcIiwgaW1wb3J0Lm1ldGEudXJsKSksXHJcbiAgICB9LFxyXG4gIH0sXHJcbiAgc2VydmVyOiB7XHJcbiAgICBob3N0OiBcIjEyNy4wLjAuMVwiLFxyXG4gICAgcG9ydDogNTE3MyxcclxuICAgIG9wZW46IGZhbHNlLFxyXG4gICAgY29yczogdHJ1ZSxcclxuICAgIHByb3h5OiB7XHJcbiAgICAgIC8vIFJlZGlyaWdlIC9hcGkgXHUyMTkyIGJhY2tlbmQgRmFzdEFQSVxyXG4gICAgICBcIi9hcGlcIjoge1xyXG4gICAgICAgIHRhcmdldDogICAgIFwiaHR0cDovLzEyNy4wLjAuMTo4NzY1XCIsXHJcbiAgICAgICAgY2hhbmdlT3JpZ2luOiB0cnVlLFxyXG4gICAgICAgIHNlY3VyZTogICAgIGZhbHNlLFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG4gIGNzczoge1xyXG4gICAgZGV2U291cmNlbWFwOiB0cnVlLFxyXG4gIH0sXHJcbiAgYnVpbGQ6IHtcclxuICAgIHRhcmdldDogXCJlczIwMjBcIixcclxuICAgIHNvdXJjZW1hcDogZmFsc2UsXHJcbiAgICBtaW5pZnk6IFwiZXNidWlsZFwiLFxyXG4gICAgcm9sbHVwT3B0aW9uczoge1xyXG4gICAgICBpbnB1dDoge1xyXG4gICAgICAgIG1haW46ICAgZmlsZVVSTFRvUGF0aChuZXcgVVJMKFwiLi9pbmRleC5odG1sXCIsIGltcG9ydC5tZXRhLnVybCkpLFxyXG4gICAgICB9LFxyXG4gICAgICBvdXRwdXQ6IHtcclxuICAgICAgICBtYW51YWxDaHVua3M6IHtcclxuICAgICAgICAgIHZlbmRvcjogW1widnVlXCIsIFwidnVlLXJvdXRlclwiLCBcInBpbmlhXCIsIFwiYXhpb3NcIl0sXHJcbiAgICAgICAgICBpY29uczogIFtcImx1Y2lkZS12dWUtbmV4dFwiXSxcclxuICAgICAgICB9LFxyXG4gICAgICB9LFxyXG4gICAgfSxcclxuICB9LFxyXG59KTtcclxuIl0sCiAgIm1hcHBpbmdzIjogIjtBQUE0WCxTQUFTLG9CQUFvQjtBQUN6WixPQUFPLFNBQVM7QUFDaEIsU0FBUyxlQUFlLFdBQVc7QUFGOE0sSUFBTSwyQ0FBMkM7QUFLbFMsSUFBTyxzQkFBUSxhQUFhO0FBQUEsRUFDMUIsTUFBTTtBQUFBO0FBQUEsRUFDTixTQUFTLENBQUMsSUFBSSxDQUFDO0FBQUEsRUFDZixTQUFTO0FBQUEsSUFDUCxPQUFPO0FBQUEsTUFDTCxLQUFLLGNBQWMsSUFBSSxJQUFJLFNBQVMsd0NBQWUsQ0FBQztBQUFBLElBQ3REO0FBQUEsRUFDRjtBQUFBLEVBQ0EsUUFBUTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sTUFBTTtBQUFBLElBQ04sT0FBTztBQUFBO0FBQUEsTUFFTCxRQUFRO0FBQUEsUUFDTixRQUFZO0FBQUEsUUFDWixjQUFjO0FBQUEsUUFDZCxRQUFZO0FBQUEsTUFDZDtBQUFBLElBQ0Y7QUFBQSxFQUNGO0FBQUEsRUFDQSxLQUFLO0FBQUEsSUFDSCxjQUFjO0FBQUEsRUFDaEI7QUFBQSxFQUNBLE9BQU87QUFBQSxJQUNMLFFBQVE7QUFBQSxJQUNSLFdBQVc7QUFBQSxJQUNYLFFBQVE7QUFBQSxJQUNSLGVBQWU7QUFBQSxNQUNiLE9BQU87QUFBQSxRQUNMLE1BQVEsY0FBYyxJQUFJLElBQUksZ0JBQWdCLHdDQUFlLENBQUM7QUFBQSxNQUNoRTtBQUFBLE1BQ0EsUUFBUTtBQUFBLFFBQ04sY0FBYztBQUFBLFVBQ1osUUFBUSxDQUFDLE9BQU8sY0FBYyxTQUFTLE9BQU87QUFBQSxVQUM5QyxPQUFRLENBQUMsaUJBQWlCO0FBQUEsUUFDNUI7QUFBQSxNQUNGO0FBQUEsSUFDRjtBQUFBLEVBQ0Y7QUFDRixDQUFDOyIsCiAgIm5hbWVzIjogW10KfQo=
