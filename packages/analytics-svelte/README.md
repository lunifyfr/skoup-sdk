# @skoup/analytics-svelte

[Skoup Analytics](https://docs.skoup.ai/en/guides/tracking) for Svelte and SvelteKit.

```svelte
<!-- src/routes/+layout.svelte -->
<script>
  import { browser } from '$app/environment'
  import { afterNavigate } from '$app/navigation'
  import { initSkoup, trackPage } from '@skoup/analytics-svelte'

  if (browser) initSkoup({ site: 'site_…', consent: 'wait', autoPageview: false, trackHistory: false })
  afterNavigate(trackPage)
</script>
```

Anywhere: `getSkoup().event('signup', { plan: 'growth' })`, `getSkoup().consent('granted')`, `getSkoup().attribution()`. Plain Svelte without SvelteKit: `initSkoup({ site })` alone — page views follow `history.pushState`.
