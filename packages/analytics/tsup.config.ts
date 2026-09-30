import { defineConfig } from 'tsup'

export default defineConfig([
  {
    entry: { index: 'src/index.ts' },
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
