import { defineConfig } from 'tsup'

export default defineConfig([
  {
    // `agents`: the server helpers (`@skoup/analytics/agents`), never in the tag.
    entry: { index: 'src/index.ts', agents: 'src/agents.ts' },
    format: ['esm', 'cjs'],
    dts: true,
    sourcemap: true,
    clean: true,
    target: 'es2020',
  },
  {
    // The tag a site pastes: `<script defer src="…/skoup.iife.js" data-site="site_…">`.
    entry: { 'skoup.iife': 'src/iife.ts' },
    format: ['iife'],
    minify: true,
    sourcemap: false,
    target: 'es2017',
    outExtension: () => ({ js: '.js' }),
  },
])
