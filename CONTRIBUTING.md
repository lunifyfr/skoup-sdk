# Contributing

Skoup Analytics measures the visits AI assistants send to a site. Its first rule is what it **never** collects (see the README of `@skoup/analytics`): a change that sends anything new must say so in that table and in the pull request.

```bash
bun install
bun run test        # every package, in jsdom
bun run typecheck
bun run build
bun run format
```

- One version for every package; `bun run release <x.y.z>` tags it, the tag publishes them all.
- A wrapper stays thin: the behaviour lives in `@skoup/analytics`, the wrapper only plugs the framework's lifecycle and router into it.
- Conventional commits (`feat:`, `fix:`, `docs:`, `chore:`).
