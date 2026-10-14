# @skoup/analytics-vue

[Skoup Analytics](https://docs.skoup.ai/en/guides/tracking) for Vue 3.

```ts
import { createSkoupPlugin } from '@skoup/analytics-vue'

app.use(createSkoupPlugin({ site: 'site_…', router, consent: 'wait' }))
```

```vue
<script setup>
import { useSkoup } from '@skoup/analytics-vue'
const skoup = useSkoup()
</script>
<button @click="skoup.event('signup', { plan: 'growth' })">Sign up</button>
```

With `router`, a page view follows each navigation. `consent: 'wait'` measures without a cookie until `skoup.consent('granted')`; `'denied'` deletes it and measures without one, `'off'` sends nothing; `skoup.attribution()` for Stripe metadata. Nuxt: `@skoup/analytics-nuxt`.
