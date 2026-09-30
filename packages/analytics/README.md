# @skoup/analytics

Measures the visits AI assistants (ChatGPT, Perplexity, Gemini, Claude…) send to your site, and the conversions they bring — the data behind **Revenue › AI traffic** in [Skoup](https://skoup.ai). 2.5 KB, no dependency, no Google Analytics.

Full guide: [docs.skoup.ai/en/guides/tracking](https://docs.skoup.ai/en/guides/tracking).

## The tag

```html
<script defer src="https://app.skoup.ai/t.js" data-site="site_…"></script>
```

Served through your own domain (`<script defer src="https://brand.com/_skoup/t.js" …>`, a reverse proxy to `app.skoup.ai/t.js`), the hits go to `https://brand.com/_skoup/t` on their own — see the [first-party proxy](https://docs.skoup.ai/en/guides/tracking#first-party-proxy) guide.

## As a module

```ts
import { createSkoup } from '@skoup/analytics'

const skoup = createSkoup({ site: 'site_…', consent: 'wait' })

// when your banner gets the consent
skoup.consent('granted')

// a sign-up, a demo request, a call…
skoup.event('signup', { plan: 'growth' })

// an order outside Shopify
skoup.event('purchase', null, { value: 129.9, currency: 'EUR', order_id: '1042' })

// what the visit came from — to write in Stripe metadata
skoup.attribution()
```

Framework wrappers: [`@skoup/analytics-react`](https://www.npmjs.com/package/@skoup/analytics-react), [`@skoup/analytics-next`](https://www.npmjs.com/package/@skoup/analytics-next), [`@skoup/analytics-vue`](https://www.npmjs.com/package/@skoup/analytics-vue), [`@skoup/analytics-nuxt`](https://www.npmjs.com/package/@skoup/analytics-nuxt), [`@skoup/analytics-svelte`](https://www.npmjs.com/package/@skoup/analytics-svelte).

## What is measured

| Sent                                                                                                                      | Never sent                                                       |
| ------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Page views: host, path, `utm_*` and `ref`                                                                                 | Page title, form contents, other query parameters, fragment      |
| Referrer without its parameters                                                                                           | Screen, language, browser, OS                                    |
| Named events and their scalar properties                                                                                  | The IP is turned into a country by the collector, then forgotten |
| A random visitor id in the `skp_vid` cookie (13 months, on the registrable domain so `www.`, `shop.` and `app.` share it) | Any identity data                                                |

The cookie needs your visitors' consent where the law requires it: load after consent, or `consent: 'wait'` then `consent('granted')`.
