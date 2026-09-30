import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COOKIE, cleanReferrer, cleanUrl, createSkoup, probeCookieDomain } from './index'

type Sent = { s: string; v: string; d?: string; e: Array<Record<string, unknown>> }

/** The hits sent through fetch (no sendBeacon in jsdom: the fallback carries a string body). */
function sentHits(sender: ReturnType<typeof vi.fn>): Sent[] {
  return sender.mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))
}

describe('cleanUrl', () => {
  it('keeps host, path and campaign parameters only', () => {
    expect(
      cleanUrl('https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com&fbclid=x&ref=y#top'),
    ).toBe('https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com&ref=y')
    expect(cleanUrl('javascript:alert(1)')).toBeNull()
    expect(cleanUrl('nope')).toBeNull()
  })
})

describe('cleanReferrer', () => {
  it('drops the query and keeps app referrers', () => {
    expect(cleanReferrer('https://chatgpt.com/c/123?x=1')).toBe('https://chatgpt.com/c/123')
    expect(cleanReferrer('android-app://com.openai.chatgpt/?x')).toBe(
      'android-app://com.openai.chatgpt/',
    )
    expect(cleanReferrer('')).toBeNull()
  })
})

describe('probeCookieDomain', () => {
  it('finds the registrable domain the browser accepts a cookie for', () => {
    expect(probeCookieDomain(document, 'nordvelo.fr')).toBe('nordvelo.fr')
    expect(probeCookieDomain(document, '127.0.0.1')).toBeNull()
    expect(probeCookieDomain(document, 'localhost')).toBeNull()
    expect(document.cookie).not.toContain('skp_probe')
  })
})

describe('createSkoup', () => {
  let beacon: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.useFakeTimers()
    beacon = vi.fn(() => Promise.resolve(new Response(null, { status: 204 })))
    Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
    window.fetch = beacon as unknown as typeof fetch
    window.history.replaceState({}, '', '/products/strade-7?utm_source=chatgpt.com&fbclid=secret')
    document.cookie = `${COOKIE}=; Max-Age=0; Path=/`
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('sends the first page view, batched, with a random visitor cookie', () => {
    const skoup = createSkoup({ site: 'site_test', debug: true })
    skoup.event('Signup', { plan: 'growth' })
    expect(beacon).not.toHaveBeenCalled()

    vi.advanceTimersByTime(1000)

    expect(beacon).toHaveBeenCalledTimes(1)
    const [hit] = sentHits(beacon)
    expect(hit.s).toBe('site_test')
    expect(hit.v).toMatch(/^v1\.[0-9a-f]{32}$/)
    expect(hit.e[0]).toMatchObject({
      t: 'pageview',
      u: 'https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com',
    })
    expect(hit.e[1]).toMatchObject({ t: 'event', n: 'signup', p: { plan: 'growth' } })
    expect(JSON.stringify(hit)).not.toContain('secret')
    expect(document.cookie).toContain(`${COOKIE}=${hit.v}`)
    // Set on the registrable domain: the brand's subdomains share the visitor.
    expect(hit.d).toBe('nordvelo.fr')
    expect(skoup.attribution()).toMatchObject({ visitor_id: hit.v, utm_source: 'chatgpt.com' })
    skoup.destroy()
  })

  it('holds the cookie back until consent is granted', () => {
    const skoup = createSkoup({ site: 'site_test', debug: true, consent: 'wait' })
    vi.advanceTimersByTime(1000)
    expect(document.cookie).not.toContain(COOKIE)

    skoup.consent('granted')
    expect(document.cookie).toContain(`${COOKIE}=${sentHits(beacon)[0].v}`)
    skoup.destroy()
  })

  it('reports a route change as a page and a purchase with its order', () => {
    const skoup = createSkoup({ site: 'site_test', debug: true })
    vi.advanceTimersByTime(1000)
    window.history.pushState({}, '', '/checkout/thank-you')
    skoup.event('purchase', null, {
      value: 129.9,
      currency: 'EUR',
      order_id: 'gid://shopify/Order/42',
    })
    vi.advanceTimersByTime(1000)

    const [, second] = sentHits(beacon)
    expect(second.e[0]).toMatchObject({
      t: 'pageview',
      u: 'https://nordvelo.fr/checkout/thank-you',
    })
    expect(second.e[1]).toMatchObject({
      t: 'event',
      n: 'purchase',
      val: 129.9,
      cur: 'EUR',
      o: 'gid://shopify/Order/42',
    })
    skoup.destroy()
  })

  it('does nothing on an automated browser without debug', () => {
    Object.defineProperty(window.navigator, 'webdriver', { value: true, configurable: true })
    const skoup = createSkoup({ site: 'site_test' })
    skoup.event('signup')
    vi.advanceTimersByTime(1000)
    expect(beacon).not.toHaveBeenCalled()
    Object.defineProperty(window.navigator, 'webdriver', { value: false, configurable: true })
  })
})
