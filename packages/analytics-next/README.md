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

Page views follow every navigation. Anywhere below: `const skoup = useSkoup()`, then `skoup.event('signup')`, `skoup.consent('granted')`, `skoup.attribution()`. Pages router: use `@skoup/analytics-react` with its provider in `_app`.
