# @skoup/analytics

Measures the visits AI assistants (ChatGPT, Perplexity, Gemini, Claude…) send to your site, and the conversions they bring — the data behind **Revenue › AI traffic** in [Skoup](https://skoup.ai). 4.5 KB gzipped, no dependency, no Google Analytics.

Full guide: [docs.skoup.ai/en/guides/tracking](https://docs.skoup.ai/en/guides/tracking).

## The tag

```html
<script defer src="https://app.skoup.ai/t.js" data-site="site_…"></script>
```

Before your visitors' consent, add `data-consent="wait"` and call `skoup('consent', 'granted')` when they accept — see [Consent](#consent).

Served through your own domain (`<script defer src="https://brand.com/_skoup/t.js" …>`, a reverse proxy to `app.skoup.ai/t.js`), the hits go to `https://brand.com/_skoup/t` on their own — see the [first-party proxy](https://docs.skoup.ai/en/guides/tracking#first-party-proxy) guide.

## WooCommerce

On the "Order received" page, the tag sends the order's `purchase` on its own (`order_id` = the WooCommerce order id), once per order and per tab. The id comes from the tag's `data-skoup-order` attribute, set by the Skoup for WooCommerce plugin, otherwise from the thank-you URL: `/checkout/order-received/{id}/?key=wc_order_…`, or `?order-received={id}&key=wc_order_…` with plain permalinks. Nothing to add to your theme.

## Google Analytics conversions

The conversions your site already sends to Google Analytics 4 are counted in Skoup too — nothing to code. The tag listens to `window.dataLayer`, where `gtag('event', name, params)` and Google Tag Manager's `dataLayer.push({ event: name, … })` both land (the entries already there, the ones pushed later, and a `dataLayer` created after the tag), and keeps **only the conversions** of this table (`GA4_CONVERSIONS`, case-insensitive):

| Google Analytics event                                   | Skoup event  |
| -------------------------------------------------------- | ------------ |
| `purchase`                                               | `purchase`   |
| `generate_lead`, `form_submit`, `submit_form`            | `lead`       |
| `sign_up`                                                | `signup`     |
| `book_appointment`, `booking`, `appointment`, `schedule` | `booking`    |
| `phone_call`, `click_to_call`, `call`                    | `call_click` |
| `contact`                                                | `contact`    |

Any other event — `page_view`, `view_item`, `add_to_cart`, `begin_checkout`… — is ignored. Of a conversion, only its Skoup name leaves, **never its parameters** (they may hold an e-mail, a name, a typed text); a `purchase` also keeps its `value`, `currency` and `transaction_id` (sent as its order id, with the cookie only — see [Consent](#consent)). It follows Skoup's consent, not Google's: `consent('off')` sends none of them.

**No double count.** A conversion your site also reports itself (`skoup('event', …)`), or sends both through gtag and Google Tag Manager, is counted once: two reports of the same Skoup event within one second are one (`DEDUP_MS`), and so are two purchases with the same order id, at any time on the page — the WooCommerce purchase included, which takes the amount Google Analytics had. A conversion from Google Analytics waits that second before it is queued, so the site's own report, with its properties, wins. With the cookie, an order already reported in the tab (a reloaded thank-you page) is not counted again.

Off with `data-gtag="off"` on the tag, or `captureGtag: false` in `createSkoup()`.

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
| The conversions sent to Google Analytics (`purchase`, `generate_lead`, `sign_up`…): their Skoup name, and a purchase's amount, currency and order id                            | Their other parameters: items, e-mail, form text…                |

The cookie needs your visitors' consent where the law requires it: `consent: 'wait'` measures without it until `consent('granted')`.

## AI assistants reading your site (server)

AI assistants and crawlers (ChatGPT, Perplexity, Claude…) fetch your pages without running any script: only your server sees them. `@skoup/analytics/agents` reports them from there — server only, never in a browser bundle: it carries your site's **proxy secret** (Réglages › Intégrations › Skoup Analytics).

```ts
import { isAiAgent, reportAiAgent } from '@skoup/analytics/agents'

// in your request handler
const userAgent = request.headers.get('user-agent')
if (isAiAgent(userAgent)) {
  // not awaited: the response is not held for it
  void reportAiAgent({
    site: 'site_…',
    secret: process.env.SKOUP_PROXY_SECRET!,
    userAgent,
    ip: clientIp, // the IP of the client, from your proxy's header
    url: request.url, // absolute: https://host/path?query
    status: 200, // optional
  })
}
```

- `isAiAgent(userAgent)` — a pre-filter on the User-Agent tokens of `AI_AGENTS` (`ChatGPT-User`, `OAI-SearchBot`, `GPTBot`, `Perplexity-User`, `PerplexityBot`, `Claude-User`, `Claude-SearchBot`, `ClaudeBot`, `MistralAI-User`, `DuckAssistBot`, `meta-externalagent`, `meta-externalfetcher`, `Amazonbot`, `Applebot`, `Bytespider`, `CCBot`). Skoup is the judge: it checks the IP against each operator's published ranges, so a request that merely claims one of these is not counted.
- `reportAiAgent({ site, secret, userAgent, ip, url, status?, endpoint?, fetch?, timeout? })` — posts one request to `https://api.skoup.ai/t/agents` (`endpoint` to change it). Resolves `true` when Skoup took it, `false` otherwise; never throws, gives up after 2 s (`timeout`). Nothing is sent without a User-Agent, an IP or an http(s) URL. The IP serves that check only, then is forgotten.

Next.js: `reportAiAgents()` of [`@skoup/analytics-next/proxy`](https://www.npmjs.com/package/@skoup/analytics-next) does all of this in `proxy.ts`.
