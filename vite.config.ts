import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'
import relay from './api/_fetchJson'

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
  server: { port: 5174 },
  test: { environment: 'node' },
})
