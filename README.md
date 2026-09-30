# skoup-sdk

The client libraries of [Skoup](https://skoup.ai): **Skoup Analytics** measures the visits AI assistants (ChatGPT, Perplexity, Gemini, Claude…) send to a site and the conversions they bring — the data behind _Revenue › AI traffic_. Guide: [docs.skoup.ai/en/guides/tracking](https://docs.skoup.ai/en/guides/tracking).

| Package                                                | For                                                      |
| ------------------------------------------------------ | -------------------------------------------------------- |
| [`@skoup/analytics`](packages/analytics)               | The core — a plain tag (`skoup.iife.js`) or an ES module |
| [`@skoup/analytics-react`](packages/analytics-react)   | React: provider, `useSkoup()`, page views on navigation  |
| [`@skoup/analytics-next`](packages/analytics-next)     | Next.js App Router: one component in the root layout     |
| [`@skoup/analytics-vue`](packages/analytics-vue)       | Vue 3: plugin with the router, `useSkoup()`              |
| [`@skoup/analytics-nuxt`](packages/analytics-nuxt)     | Nuxt 3: a module                                         |
| [`@skoup/analytics-svelte`](packages/analytics-svelte) | Svelte / SvelteKit                                       |

## Development

```bash
bun install
bun run test        # the core, in jsdom
bun run typecheck
bun run build
```

A `v*` tag publishes every package to npm at the version of its `package.json` (`NPM_TOKEN` secret). All packages share one version.

MIT © Lunify SAS
