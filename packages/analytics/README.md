# @skoup/analytics

Measures the visits AI assistants (ChatGPT, Perplexity, Gemini, Claude…) send to your site, and the conversions they bring — the data behind **Revenue › AI traffic** in [Skoup](https://skoup.ai). 2.5 KB, no dependency, no Google Analytics.

Full guide: [docs.skoup.ai/en/guides/tracking](https://docs.skoup.ai/en/guides/tracking).

## The tag

```html
<script defer src="https://app.skoup.ai/t.js" data-site="site_…"></script>
```

Before your visitors' consent, add `data-consent="wait"` and call `skoup('consent', 'granted')` when they accept — see [Consent](#consent).

Served through your own domain (`<script defer src="https://brand.com/_skoup/t.js" …>`, a reverse proxy to `app.skoup.ai/t.js`), the hits go to `https://brand.com/_skoup/t` on their own — see the [first-party proxy](https://docs.skoup.ai/en/guides/tracking#first-party-proxy) guide.

## WooCommerce

On the "Order received" page, the tag sends the order's `purchase` on its own (`order_id` = the WooCommerce order id), once per order and per tab. The id comes from the tag's `data-skoup-order` attribute, set by the Skoup for WooCommerce plugin, otherwise from the thank-you URL: `/checkout/order-received/{id}/?key=wc_order_…`, or `?order-received={id}&key=wc_order_…` with plain permalinks. Nothing to add to your theme.

## As a module

```ts
import { createSkoup } from '@skoup/analytics'

const skoup = createSkoup({ site: 'site_…', consent: 'wait' })

// when your banner gets the consent
skoup.consent('granted')
// when the visitor refuses it, or objects to any measurement
skoup.consent('denied') // or 'off'

// a sign-up, a demo request, a call…
skoup.event('signup', { plan: 'growth' })

// an order outside Shopify
skoup.event('purchase', null, { value: 129.9, currency: 'EUR', order_id: '1042' })

// what the visit came from — to write in Stripe metadata
skoup.attribution()
```

Framework wrappers: [`@skoup/analytics-react`](https://www.npmjs.com/package/@skoup/analytics-react), [`@skoup/analytics-next`](https://www.npmjs.com/package/@skoup/analytics-next), [`@skoup/analytics-vue`](https://www.npmjs.com/package/@skoup/analytics-vue), [`@skoup/analytics-nuxt`](https://www.npmjs.com/package/@skoup/analytics-nuxt), [`@skoup/analytics-svelte`](https://www.npmjs.com/package/@skoup/analytics-svelte).

## Consent

Two modes, so every visit counts, with or without the cookie:

- **Without a cookie** (`consent: 'wait'` or `'denied'`): nothing is read or stored on the visitor's device; the visit is counted page by page, and a purchase keeps its amount but not its order.
- **With the cookie** (`'granted'`, the default): the visitor is recognised from one visit to the next, and a purchase is joined to its order.

| Call                 | Effect                                                                                       |
| -------------------- | -------------------------------------------------------------------------------------------- |
| `consent('granted')` | Switches to the cookie; the visit under way keeps its id, the events not sent yet follow it. |
| `consent('denied')`  | Deletes the cookie and measures without one again.                                           |
| `consent('off')`     | The visitor objects: the cookie is deleted and nothing is sent any more.                     |
| `consent('wait')`    | Measures without a cookie (lifts `off`).                                                     |

The SDK remembers none of these choices: your consent tool does, and calls `consent()` again on every page load (`data-consent` on the tag). Each hit sent without the cookie says so (`c: 0`).

## What is measured

| Sent                                                                                                                                                                            | Never sent                                                       |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Page views: host, path, `utm_*` and `ref`                                                                                                                                       | Page title, form contents, other query parameters, fragment      |
| Referrer without its parameters                                                                                                                                                 | Screen, language, browser, OS                                    |
| Named events and their scalar properties                                                                                                                                        | The IP is turned into a country by the collector, then forgotten |
| A random visitor id: in memory for the page without consent, in the `skp_vid` cookie (13 months, on the registrable domain so `www.`, `shop.` and `app.` share it) once granted | Any identity data                                                |
| The order id of a `purchase`, once granted                                                                                                                                      | Without consent: any order id, anything on the device            |

The cookie needs your visitors' consent where the law requires it: `consent: 'wait'` measures without it until `consent('granted')`.
