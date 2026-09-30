import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    environment: 'jsdom',
    environmentOptions: {
      jsdom: { url: 'https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com&fbclid=secret' },
    },
  },
})
