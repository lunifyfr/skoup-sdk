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

`bun run release 0.2.0` aligns every package on the version, commits, tags `v0.2.0` and pushes; the tag makes the CI publish the six packages to npm (secret `NPM_TOKEN`, a granular access token of the `skoup` org allowed to bypass 2FA) and open the GitHub release. All packages share one version.

MIT © Lunify SAS
