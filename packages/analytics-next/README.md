# @skoup/analytics-next

[Skoup Analytics](https://docs.skoup.ai/en/guides/tracking) for Next.js (App Router).

```tsx
// app/layout.tsx
import { SkoupAnalytics } from '@skoup/analytics-next'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        <SkoupAnalytics site="site_…" consent="wait">
          {children}
        </SkoupAnalytics>
      </body>
    </html>
  )
}
```

`consent="wait"` measures without a cookie until `skoup.consent('granted')`; `'denied'` deletes it and measures without one, `'off'` sends nothing. Page views follow every navigation. Anywhere below: `const skoup = useSkoup()`, then `skoup.event('signup')`, `skoup.consent('granted')`, `skoup.attribution()`. Pages router: use `@skoup/analytics-react` with its provider in `_app`.

## AI assistants reading your site

AI assistants and crawlers (ChatGPT, Perplexity, Claude…) fetch your pages without running the script: only your server sees them. In `proxy.ts` (Next 16, `middleware.ts` before), `reportAiAgents()` reports them to Skoup:

```ts
// proxy.ts
import { NextResponse, type NextFetchEvent, type NextRequest } from 'next/server'
import { reportAiAgents } from '@skoup/analytics-next/proxy'

export function proxy(request: NextRequest, event: NextFetchEvent) {
  reportAiAgents(request, event, {
    site: process.env.SKOUP_SITE,
    secret: process.env.SKOUP_PROXY_SECRET, // never NEXT_PUBLIC_
  })
  return NextResponse.next()
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

It does nothing unless the User-Agent is a known AI agent (`isAiAgent`, see [`@skoup/analytics`](https://www.npmjs.com/package/@skoup/analytics#ai-assistants-reading-your-site-server)), or without `site` / `secret`. Otherwise it sends the request — User-Agent, URL, client IP (the first `x-forwarded-for`, else `x-real-ip`) — in `event.waitUntil()`: the response is not held for it, and an error of the collector is swallowed. The proxy secret is in Réglages › Intégrations › Skoup Analytics; keep it in a server environment variable. Options: `endpoint`, `fetch`, `timeout` (2 s).
