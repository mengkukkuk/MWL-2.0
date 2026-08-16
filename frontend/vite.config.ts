import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

import { cloudflare } from "@cloudflare/vite-plugin";

// The Flask origin. Everything is served same-origin in production; in dev the
// proxy below makes the browser believe that is true here too.
const BACKEND = process.env.VITE_BACKEND_ORIGIN ?? 'http://127.0.0.1:5112';

export default defineConfig(({ command }) => ({
  plugins: [react(), cloudflare()],
  // Flask serves the production bundle from /static; Vite needs root-relative
  // module URLs in dev so BrowserRouter can own /login and the app routes.
  base: command === 'build' ? '/static/' : '/',
  build: {
    outDir: '../static',
    emptyOutDir: true,
    sourcemap: true,
    rollupOptions: {
      output: {
        // app/__init__.py sends `max-age=31536000, immutable` for /static/*, so
        // filenames must change whenever content does or clients pin stale JS.
        entryFileNames: 'assets/[name].[hash].js',
        chunkFileNames: 'assets/[name].[hash].js',
        assetFileNames: 'assets/[name].[hash][extname]',
      },
    },
  },
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: BACKEND,
        changeOrigin: true,
        // changeOrigin only rewrites Host. verify_api_csrf_origin in
        // app/__init__.py compares Origin/Referer against request.host_url, so
        // without these two headers every non-GET request 403s in dev.
        headers: { Origin: BACKEND, Referer: BACKEND + '/' },
      },
      '/logout': { target: BACKEND, changeOrigin: true },
    },
  },
}));