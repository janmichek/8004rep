import vue from '@vitejs/plugin-vue'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [vue()],
  // Relative asset paths so the static bundle works from any sub-path.
  base: './',
  server: { port: 5174 },
  test: { environment: 'node' },
})
