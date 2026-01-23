import base44 from "@base44/vite-plugin"
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// https://vite.dev/config/
export default defineConfig({
  logLevel: 'error', // Suppress warnings, only show errors
  // Dev server proxy settings (useful for local/staging dev)
  server: {
    proxy: {
      '/api': {
        // Prefer explicit Vite proxy env, then production PROXY_TARGET, then legacy base44 env, then fallback
        target: process.env.VITE_API_PROXY || process.env.PROXY_TARGET || process.env.VITE_BASE44_APP_BASE_URL || 'http://localhost:4000',
        changeOrigin: true,
        secure: false,
        // preserve the /api prefix so dev behavior matches production
        rewrite: (path) => path,
        // attach a small logger so dev console shows the exact forwarded URL
        configure: (proxy) => {
          proxy.on('proxyReq', (proxyReq, req, res) => {
            try {
              const target = (proxy && proxy.options && proxy.options.target) || process.env.VITE_API_PROXY || process.env.PROXY_TARGET || process.env.VITE_BASE44_APP_BASE_URL || 'http://localhost:4000';
              const url = req.url || '';
              const forwarded = new URL(url, target);
              // eslint-disable-next-line no-console
              console.log(`[vite proxy] ${req.method} ${url} -> ${forwarded.href}`);
            } catch (err) {
              // ignore logging errors
            }
          });
        }
      }
    }
  },
  plugins: [
    base44({
      // Support for legacy code that imports the base44 SDK with @/integrations, @/entities, etc.
      // can be removed if the code has been updated to use the new SDK imports from @base44/sdk
      legacySDKImports: process.env.BASE44_LEGACY_SDK_IMPORTS === 'true',
      hmrNotifier: true
    }),
    react(),
  ]
});