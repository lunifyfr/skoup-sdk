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
 * Two modes:
 * - **without a cookie** (`consent: 'wait'` or `'denied'`): nothing is
 *   read or written on the visitor's device — no cookie, no
 *   `sessionStorage`. The visitor id is a random value kept in memory for
 *   the page (a single-page app keeps it from one route to the next),
 *   every hit says so (`c: 0`) and no event carries an order id: an
 *   amount, never a join with an order.
 * - **with the cookie** (`'granted'`, the default): the visitor id lives
 *   in the first-party cookie `skp_vid` (13 months), set on the site's
 *   registrable domain (`nordvelo.fr` for `www.` and `app.` alike —
 *   probed, or `cookieDomain`) so one visitor stays one across the
 *   brand's subdomains and visits.
 *
 * `consent('granted')` switches to the cookie without losing the visit
 * under way; `consent('denied')` deletes it and goes back to the mode
 * without a cookie. `consent('off')` is the visitor's objection: nothing
 * is sent any more until another state lifts it. The SDK keeps none of
 * these choices itself — the site's consent tool remembers them and calls
 * `consent()` again on every load.
 */

/**
 * `granted`: measured with the visitor cookie. `wait` / `denied`: measured
 * without storing anything on the device. `off`: the visitor objects,
 * nothing is measured.
 */
export type ConsentState = 'granted' | 'wait' | 'denied' | 'off'

export interface SkoupOptions {
  /** The brand's site key (`site_…`), from Réglages › Intégrations › Skoup Analytics. */
  site: string
  /** The collector; the Skoup one by default. A first-party proxy goes here. */
  endpoint?: string
  /**
   * `'granted'` (default): the visitor cookie `skp_vid`. `'wait'` or
   * `'denied'`: measured without anything stored on the device until
   * `consent('granted')`. `'off'`: the visitor objects, nothing is sent.
   */
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
  /**
   * The store's order id (`gid://shopify/Order/…`, an order number…), joined
   * to the order Skoup received — sent with the cookie only.
   */
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
  /**
   * Sets or lifts the consent: `granted` switches to the cookie (the visit
   * under way keeps its id), `denied` deletes it and measures without one,
   * `off` deletes it and sends nothing more (the events not sent yet are
   * dropped) until another state lifts it.
   */
  consent(state: ConsentState): void
  /**
   * What the visit came from — to write in Stripe metadata. Kept for the
   * browser session with the cookie, for the page without it.
   */
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

/** A hit as sent without the cookie: no order id (`o`) nor checkout token (`ck`). */
function withoutJoin(hit: Hit): Hit {
  if (!('o' in hit) && !('ck' in hit)) return hit
  const { o: _o, ck: _ck, ...rest } = hit
  return rest as Hit
}

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

/**
 * Deletes the visitor cookie wherever it may have been set: host-only and
 * on every parent domain of the host (no probe needed — an expired cookie
 * stores nothing, and the browser ignores a public suffix).
 */
function dropCookie(doc: Document, hostname: string, domain: string | null): void {
  const domains = new Set<string>()
  if (domain) domains.add(domain)
  if (!/^[\d.]+$/.test(hostname) && !hostname.includes(':')) {
    const labels = hostname.split('.')
    for (let i = labels.length - 2; i >= 0; i--) domains.add(labels.slice(i).join('.'))
  }
  for (const each of domains)
    doc.cookie = `${COOKIE}=; Max-Age=0; Path=/; SameSite=Lax; Domain=${each}`
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
  const secure = w.location.protocol === 'https:'
  // The cookie domain, probed (a test cookie) only once the cookie is allowed.
  let domain: string | null = null
  let probed = false
  let visitor: string | null = null
  let attribution: Attribution | null = null
  let queue: Hit[] = []
  let timer: number | null = null

  const cookies = (): boolean => consent === 'granted'

  const cookieDomain = (): string | null => {
    if (!probed) {
      domain = options.cookieDomain ?? probeCookieDomain(d, w.location.hostname)
      probed = true
    }
    return domain
  }

  // Without the cookie: a random id in memory, for this page only.
  const visitorId = (): string => {
    if (visitor) return visitor
    if (!cookies()) return (visitor = randomVisitorId())
    visitor = readCookie(d) ?? randomVisitorId()
    writeCookie(d, visitor, secure, cookieDomain())
    return visitor
  }

  const store = (value: Attribution): void => {
    try {
      w.sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value))
    } catch {
      /* storage blocked: attribution lives for this page only */
    }
  }

  const stored = (): Attribution | null => {
    try {
      const raw = w.sessionStorage.getItem(STORAGE_KEY)
      const parsed = raw ? (JSON.parse(raw) as Attribution) : null
      return parsed && parsed.visitor_id === visitorId() ? parsed : null
    } catch {
      return null
    }
  }

  const send = (): void => {
    timer = null
    if (!queue.length) return
    // Read at send time: hits queued before `consent('granted')` leave with the cookie's id.
    const queued = queue.splice(0, MAX_EVENTS_PER_HIT)
    const events = cookies() ? queued : queued.map(withoutJoin)
    const v = visitorId()
    // `c: 0`: measured without a cookie — the collector sets none either.
    // `d`: the cookie domain the browser accepted — the collector sets the same
    // cookie in its response when the hit comes through a first-party proxy.
    const dom = cookies() ? cookieDomain() : null
    const body = JSON.stringify(
      !cookies()
        ? { s: site, v, c: 0, e: events }
        : dom
          ? { s: site, v, d: dom, e: events }
          : { s: site, v, e: events },
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
    if (consent === 'off') return
    queue.push({ ...hit, ts: Date.now() } as Hit)
    if (!timer) timer = w.setTimeout(send, BATCH_MS)
  }

  const pageview = (referrer?: string | null): void => {
    if (consent === 'off') return
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
      if (cookies()) store(attribution)
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

  /** Deletes what a granted consent stored: the cookie and the attribution. */
  const forget = (): void => {
    dropCookie(d, w.location.hostname, domain)
    try {
      w.sessionStorage.removeItem(STORAGE_KEY)
    } catch {
      /* storage blocked: nothing was kept */
    }
  }

  const setConsent = (state: ConsentState): void => {
    const before = consent
    consent = state
    if (state === 'granted') {
      // The cookie of an earlier visit wins; otherwise the visit under way keeps its id.
      visitor = readCookie(d) ?? visitor ?? randomVisitorId()
      writeCookie(d, visitor, secure, cookieDomain())
      const kept = stored()
      if (kept) attribution = kept
      else if (attribution) store((attribution = { ...attribution, visitor_id: visitor }))
      return
    }
    if (state === 'denied' || state === 'off') forget()
    if (state === 'off') {
      // The objection: what was not sent yet is dropped, nothing more leaves.
      queue = []
      if (timer) w.clearTimeout(timer)
      timer = null
      visitor = null
      attribution = null
      return
    }
    // Back without the cookie: a fresh id in memory, never the cookie's.
    if (before === 'granted') {
      visitor = randomVisitorId()
      if (attribution) attribution = { ...attribution, visitor_id: visitor }
    }
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

  if (cookies()) attribution = stored()
  // Refused or objected to: what an earlier consent left on the device goes.
  else if (consent === 'denied' || consent === 'off') forget()
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
