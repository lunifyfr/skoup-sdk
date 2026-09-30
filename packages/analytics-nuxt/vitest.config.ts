import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (name: string) => fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  test: { environment: 'jsdom' },
  resolve: {
    alias: {
      '@skoup/analytics-react': fileURLToPath(
        new URL('../analytics-react/src/index.tsx', import.meta.url),
      ),
      '@skoup/analytics-vue': src('analytics-vue'),
      '@skoup/analytics': src('analytics'),
      '#app': fileURLToPath(new URL('./src/runtime/nuxt-app.stub.ts', import.meta.url)),
    },
  },
})
