/**
 * Skoup Analytics — the core of the script a brand installs on its site
 * (see https://docs.skoup.ai/fr/guides/tracking). Measures the visit
 * (pages, referrer, campaign parameters) and the named events the site
 * sends, batched to the collector as `text/plain` JSON (no preflight,
 * `sendBeacon`).
 *
 * Never collected: the page title, form contents, any query parameter
 * but `utm_*` / `ref`, the URL fragment, screen or language — and the
 * collector turns the IP into a country and forgets it.
 *
 * The visitor id lives in the first-party cookie `skp_vid` (13 months),
 * set on the site's registrable domain (`nordvelo.fr` for `www.` and
 * `app.` alike — probed, or `cookieDomain`) so one visitor stays one
 * across the brand's subdomains. Load the script after your visitors'
 * consent, or pass `consent: 'wait'` and call `consent('granted')` when
 * they accept.
 */

export type ConsentState = 'granted' | 'wait' | 'denied'

export interface SkoupOptions {
  /** The brand's site key (`site_…`), from Réglages › Intégrations › Skoup Analytics. */
  site: string
  /** The collector; the Skoup one by default. A first-party proxy goes here. */
  endpoint?: string
  /** `'wait'` holds the cookie back until `consent('granted')`. Default: granted. */
  consent?: ConsentState
  /** Also measure on localhost and automated browsers (off by default). */
  debug?: boolean
  /** Send the first page view at init (default true). Off for a router that reports pages itself. */
  autoPageview?: boolean
  /** Patch `history.pushState` / `popstate` to report route changes (default true). */
  trackHistory?: boolean
  /**
   * Domain of the visitor cookie, so the brand's subdomains share it
   * (`nordvelo.fr`). Default: the shortest suffix of the host the browser
   * accepts a cookie for — its registrable domain.
   */
  cookieDomain?: string
}

export interface EventExtra {
  /** Amount of a `purchase`. */
  value?: number
  /** ISO 4217 currency of the amount. */
  currency?: string
  /** The store's order id (`gid://shopify/Order/…`, an order number…), joined to the order Skoup received. */
  order_id?: string
}

export type EventProperties = Record<string, string | number | boolean>

export interface Attribution {
  visitor_id: string
  referrer: string | null
  landing_url: string
  utm_source: string | null
  utm_medium: string | null
  utm_campaign: string | null
}

export interface Skoup {
  /** A page seen — the current location (a router's route change). */
  pageview(referrer?: string | null): void
  /** A named event: a sign-up, a demo request, a call… or a `purchase`. */
  event(name: string, properties?: EventProperties | null, extra?: EventExtra): void
  /** Sets or lifts the consent: `granted` writes the cookie, `denied` drops it. */
  consent(state: ConsentState): void
  /** What the visit came from, kept for the browser session — to write in Stripe metadata. */
  attribution(): Attribution | null
  /** Sends the buffered events now. */
  flush(): void
  /** Stops listening to the history; nothing else is sent. */
  destroy(): void
}

export const DEFAULT_ENDPOINT = 'https://api.skoup.ai/t'
export const COOKIE = 'skp_vid'
/** 13 months, the ceiling for a measurement cookie. */
export const COOKIE_MAX_AGE = 395 * 86400
const KEPT_QUERY = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref']
const MAX_EVENTS_PER_HIT = 25
const BATCH_MS = 1000
const STORAGE_KEY = 'skoup_attribution'
const VISITOR_PATTERN = /^v1\.[0-9a-f]{32}$/

type Hit = Record<string, unknown> & { t: 'pageview' | 'event'; ts: number }

export function randomVisitorId(): string {
  const bytes = new Uint8Array(16)
  if (typeof crypto !== 'undefined' && crypto.getRandomValues) crypto.getRandomValues(bytes)
  else for (let i = 0; i < 16; i++) bytes[i] = Math.floor(Math.random() * 256)
  let hex = ''
  for (let i = 0; i < 16; i++) hex += (bytes[i] < 16 ? '0' : '') + bytes[i].toString(16)
  return 'v1.' + hex
}

/** `https://host/path?utm_source=…` — host, path and the campaign parameters only; null when unparsable. */
export function cleanUrl(href: string, base?: string): string | null {
  try {
    const url = new URL(href, base)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    const kept = new URLSearchParams()
    for (const key of KEPT_QUERY) {
      const value = url.searchParams.get(key)
      if (value) kept.set(key, value.slice(0, 255))
    }
    const query = kept.toString()
    return url.origin + url.pathname + (query ? '?' + query : '')
  } catch {
    return null
  }
}

/** The referrer without its query or fragment; an `android-app://` referrer is kept as is. */
export function cleanReferrer(referrer: string | null | undefined): string | null {
  if (!referrer) return null
  if (referrer.startsWith('android-app://')) return referrer.split(/[?#]/)[0]
  try {
    const url = new URL(referrer)
    return url.origin + url.pathname
  } catch {
    return null
  }
}

function readCookie(doc: Document): string | null {
  const match = doc.cookie.match(new RegExp('(?:^|; )' + COOKIE + '=(v1\\.[0-9a-f]{32})'))
  return match ? match[1] : null
}

function writeCookie(doc: Document, id: string, secure: boolean, domain: string | null): void {
  doc.cookie = `${COOKIE}=${id}; Max-Age=${COOKIE_MAX_AGE}; Path=/; SameSite=Lax${secure ? '; Secure' : ''}${domain ? '; Domain=' + domain : ''}`
}

function dropCookie(doc: Document, domain: string | null): void {
  doc.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax${domain ? '; Domain=' + domain : ''}`
  doc.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax`
}

/**
 * The registrable domain of the page (`nordvelo.fr` for `app.nordvelo.fr`,
 * `example.co.uk` for `shop.example.co.uk`): the shortest suffix the
 * browser accepts a cookie for — it refuses a public suffix. Null for an
 * IP address or a single-label host (a host-only cookie then).
 */
export function probeCookieDomain(doc: Document, hostname: string): string | null {
  if (/^[\d.]+$/.test(hostname) || hostname.includes(':')) return null
  const labels = hostname.split('.')
  if (labels.length < 2) return null
  const probe = 'skp_probe'
  for (let i = labels.length - 2; i >= 0; i--) {
    const domain = labels.slice(i).join('.')
    doc.cookie = `${probe}=1; Path=/; SameSite=Lax; Domain=${domain}`
    if (doc.cookie.includes(`${probe}=1`)) {
      doc.cookie = `${probe}=; Max-Age=0; Path=/; Domain=${domain}`
      return domain
    }
  }
  return null
}

/** A no-op instance: no site key, an automated browser, localhost without `debug`. */
export function noopSkoup(): Skoup {
  const none = () => {}
  return {
    pageview: none,
    event: none,
    consent: none,
    attribution: () => null,
    flush: none,
    destroy: none,
  }
}

/**
 * Creates the instance measuring this page. One per page: the IIFE build
 * and every framework wrapper call it once.
 */
export function createSkoup(options: SkoupOptions, w: Window = window): Skoup {
  const d = w.document
  const site = (options.site || '').trim()
  const endpoint = options.endpoint || DEFAULT_ENDPOINT
  const automated = Boolean((w.navigator as Navigator & { webdriver?: boolean }).webdriver)
  const local = /^(localhost|127\.0\.0\.1)$/.test(w.location.hostname)

  if (!site || (!options.debug && (automated || local))) return noopSkoup()

  let consent: ConsentState = options.consent ?? 'granted'
  const domain = options.cookieDomain ?? probeCookieDomain(d, w.location.hostname)
  let visitor: string | null = null
  let attribution: Attribution | null = null
  let queue: Hit[] = []
  let timer: number | null = null

  const visitorId = (): string => {
    if (visitor) return visitor
    visitor = readCookie(d) ?? randomVisitorId()
    if (consent === 'granted') writeCookie(d, visitor, w.location.protocol === 'https:', domain)
    return visitor
  }

  const send = (): void => {
    timer = null
    if (!queue.length) return
    const events = queue.splice(0, MAX_EVENTS_PER_HIT)
    // `d`: the cookie domain the browser accepted — the collector sets the same
    // cookie in its response when the hit comes through a first-party proxy.
    const body = JSON.stringify(
      domain
        ? { s: site, v: visitorId(), d: domain, e: events }
        : { s: site, v: visitorId(), e: events },
    )
    let sent = false
    if (w.navigator.sendBeacon) {
      try {
        sent = w.navigator.sendBeacon(endpoint, new Blob([body], { type: 'text/plain' }))
      } catch {
        sent = false
      }
    }
    if (!sent && w.fetch) {
      w.fetch(endpoint, {
        method: 'POST',
        body,
        mode: 'no-cors',
        keepalive: true,
        headers: { 'Content-Type': 'text/plain' },
      }).catch(() => {})
    }
    if (queue.length) send()
  }

  const push = (hit: Omit<Hit, 'ts'>): void => {
    queue.push({ ...hit, ts: Date.now() } as Hit)
    if (!timer) timer = w.setTimeout(send, BATCH_MS)
  }

  const remember = (): void => {
    try {
      const stored = w.sessionStorage.getItem(STORAGE_KEY)
      const parsed = stored ? (JSON.parse(stored) as Attribution) : null
      attribution = parsed && parsed.visitor_id === visitorId() ? parsed : null
    } catch {
      attribution = null
    }
  }

  const pageview = (referrer?: string | null): void => {
    const url = cleanUrl(w.location.href)
    if (!url) return
    const ref = cleanReferrer(referrer === undefined ? d.referrer : referrer)
    if (!attribution) {
      const params = new URLSearchParams(w.location.search)
      attribution = {
        visitor_id: visitorId(),
        referrer: ref,
        landing_url: url,
        utm_source: params.get('utm_source'),
        utm_medium: params.get('utm_medium'),
        utm_campaign: params.get('utm_campaign'),
      }
      try {
        w.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(attribution))
      } catch {
        /* storage blocked: attribution lives for this page only */
      }
    }
    push(ref ? { t: 'pageview', u: url, r: ref } : { t: 'pageview', u: url })
  }

  const event = (name: string, properties?: EventProperties | null, extra?: EventExtra): void => {
    if (typeof name !== 'string' || !name.trim()) return
    const hit: Omit<Hit, 'ts'> = { t: 'event', n: name.trim().toLowerCase() }
    if (properties && typeof properties === 'object') hit.p = properties
    if (extra) {
      if (typeof extra.value === 'number') hit.val = extra.value
      if (typeof extra.currency === 'string') hit.cur = extra.currency
      if (typeof extra.order_id === 'string') hit.o = extra.order_id
    }
    push(hit)
  }

  const setConsent = (state: ConsentState): void => {
    consent = state
    if (state === 'granted') writeCookie(d, visitorId(), w.location.protocol === 'https:', domain)
    if (state === 'denied') dropCookie(d, domain)
  }

  // Single-page apps: a route change is a page.
  let lastPath = w.location.pathname + w.location.search
  const routed = (): void => {
    const path = w.location.pathname + w.location.search
    if (path === lastPath) return
    lastPath = path
    pageview(null)
  }
  const originalPushState = w.history.pushState
  const onHidden = (): void => {
    if (d.visibilityState === 'hidden') send()
  }

  if (options.trackHistory !== false) {
    w.history.pushState = function (this: History, ...args: Parameters<History['pushState']>) {
      originalPushState.apply(this, args)
      routed()
    }
    w.addEventListener('popstate', routed)
  }
  w.addEventListener('pagehide', send)
  d.addEventListener('visibilitychange', onHidden)

  remember()
  if (options.autoPageview !== false) pageview()

  return {
    pageview,
    event,
    consent: setConsent,
    attribution: () => attribution,
    flush: send,
    destroy: () => {
      send()
      if (options.trackHistory !== false) {
        w.history.pushState = originalPushState
        w.removeEventListener('popstate', routed)
      }
      w.removeEventListener('pagehide', send)
      d.removeEventListener('visibilitychange', onHidden)
    },
  }
}

export { VISITOR_PATTERN }
