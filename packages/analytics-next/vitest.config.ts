import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

const src = (name: string) => fileURLToPath(new URL(`../${name}/src/index.ts`, import.meta.url))

export default defineConfig({
  test: { environment: 'jsdom' },
  resolve: {
    alias: {
      // Before `@skoup/analytics`, which would otherwise take the subpath.
      '@skoup/analytics/agents': fileURLToPath(
        new URL('../analytics/src/agents.ts', import.meta.url),
      ),
      '@skoup/analytics-react': fileURLToPath(
        new URL('../analytics-react/src/index.tsx', import.meta.url),
      ),
      '@skoup/analytics-vue': src('analytics-vue'),
      '@skoup/analytics': src('analytics'),
    },
  },
})
