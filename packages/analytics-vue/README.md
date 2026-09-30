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

With `router`, a page view follows each navigation. `skoup.consent('granted')` when the banner gets the consent, `skoup.attribution()` for Stripe metadata. Nuxt: `@skoup/analytics-nuxt`.
