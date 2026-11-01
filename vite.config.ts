import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import relay from './api/fetch-json'

export default defineConfig({
  plugins: [
    vue(),
    {
      // Same CORS relay the Vercel function provides, for `vite dev`.
      name: 'fetch-json-relay',
      configureServer(server) {
        server.middlewares.use('/api/fetch-json', (req, res) => void relay(req, res))
      },
    },
  ],
  // Relative asset paths so the static bundle works from any sub-path.
  base: './',
  // strictPort: localStorage is per origin (scheme + host + port), so stars
  // only follow you while dev always runs on this one port. Vite must fail
  // instead of silently moving to 5175 and opening an empty star list.
  server: { port: 5174, strictPort: true },
  test: { environment: 'node' },
})
