# @skoup/analytics-react

[Skoup Analytics](https://docs.skoup.ai/en/guides/tracking) for React.

```tsx
import { SkoupProvider, useSkoup } from '@skoup/analytics-react'

// once, around the app — after your visitors' consent, or with consent="wait"
;<SkoupProvider site="site_…" consent="wait">
  <App />
</SkoupProvider>

function SignupButton() {
  const skoup = useSkoup()
  return <button onClick={() => skoup.event('signup', { plan: 'growth' })}>Sign up</button>
}
```

Page views follow `history.pushState` (React Router). For a router the provider cannot observe, give it `autoPageview={false} trackHistory={false}` and call `useSkoupPageview(location.pathname + location.search)` where the route is known. When the banner gets the consent: `skoup.consent('granted')`.
