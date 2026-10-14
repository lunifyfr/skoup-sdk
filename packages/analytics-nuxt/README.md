# @skoup/analytics-nuxt

[Skoup Analytics](https://docs.skoup.ai/en/guides/tracking) for Nuxt 3.

```ts
// nuxt.config.ts
export default defineNuxtConfig({
  modules: ['@skoup/analytics-nuxt'],
  skoup: { site: 'site_…', consent: 'wait' },
})
```

`consent: 'wait'` measures without a cookie until `skoup.consent('granted')`; `'denied'` deletes it and measures without one, `'off'` sends nothing. Page views follow each navigation, on the client only. In a component: `import { useSkoup } from '@skoup/analytics-vue'`, then `skoup.event('signup')`, `skoup.consent('granted')`, `skoup.attribution()`.
