import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { COOKIE, cleanReferrer, cleanUrl, createSkoup, probeCookieDomain } from './index'

type Sent = { s: string; v: string; d?: string; c?: number; e: Array<Record<string, unknown>> }

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
    document.cookie = `${COOKIE}=; Max-Age=0; Path=/; Domain=nordvelo.fr`
    sessionStorage.clear()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.restoreAllMocks()
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

  describe('without a cookie (wait / denied)', () => {
    /** Every write to `document.cookie`, the probe included. */
    let writes: string[]
    let restoreCookie: () => void

    beforeEach(() => {
      writes = []
      const descriptor = Object.getOwnPropertyDescriptor(Document.prototype, 'cookie')!
      Object.defineProperty(document, 'cookie', {
        configurable: true,
        get: () => descriptor.get!.call(document),
        set: (value: string) => {
          writes.push(value)
          descriptor.set!.call(document, value)
        },
      })
      restoreCookie = () => delete (document as unknown as { cookie?: string }).cookie
    })

    afterEach(() => restoreCookie())

    it('stores nothing on the device and keeps one in-memory id for the page', () => {
      const getItem = vi.spyOn(Storage.prototype, 'getItem')
      const skoup = createSkoup({ site: 'site_test', debug: true, consent: 'wait' })
      window.history.pushState({}, '', '/pricing')
      skoup.event('purchase', null, { value: 49, currency: 'EUR', order_id: '1042' })
      vi.advanceTimersByTime(1000)

      const [hit] = sentHits(beacon)
      expect(hit.c).toBe(0)
      expect(hit.d).toBeUndefined()
      expect(hit.v).toMatch(/^v1\.[0-9a-f]{32}$/)
      // Two pages of the same load, one visit.
      expect(hit.e.filter((e) => e.t === 'pageview')).toHaveLength(2)
      // The amount stays, never the order: no join without consent.
      expect(hit.e[2]).toMatchObject({ t: 'event', n: 'purchase', val: 49, cur: 'EUR' })
      expect(hit.e[2]).not.toHaveProperty('o')

      window.history.pushState({}, '', '/checkout')
      vi.advanceTimersByTime(1000)
      expect(sentHits(beacon)[1].v).toBe(hit.v)

      expect(writes).toEqual([])
      expect(document.cookie).toBe('')
      expect(getItem).not.toHaveBeenCalled()
      expect(sessionStorage.length).toBe(0)
      expect(skoup.attribution()).toMatchObject({ visitor_id: hit.v, utm_source: 'chatgpt.com' })
      skoup.destroy()
    })

    it('switches to the cookie on consent, keeping the visit under way', () => {
      const skoup = createSkoup({ site: 'site_test', debug: true, consent: 'wait' })
      vi.advanceTimersByTime(1000)
      const before = sentHits(beacon)[0]
      expect(before.c).toBe(0)

      skoup.event('purchase', null, { value: 49, currency: 'EUR', order_id: '1042' })
      skoup.consent('granted')
      expect(document.cookie).toContain(`${COOKIE}=${before.v}`)
      expect(JSON.parse(sessionStorage.getItem('skoup_attribution')!).visitor_id).toBe(before.v)
      vi.advanceTimersByTime(1000)

      // Queued before the consent, sent after it: with the cookie and the order.
      const after = sentHits(beacon)[1]
      expect(after.v).toBe(before.v)
      expect(after.c).toBeUndefined()
      expect(after.d).toBe('nordvelo.fr')
      expect(after.e[0]).toMatchObject({ n: 'purchase', o: '1042' })
      skoup.destroy()
    })

    it('adopts the cookie of an earlier visit on consent', () => {
      const earlier = 'v1.' + 'a'.repeat(32)
      document.cookie = `${COOKIE}=${earlier}; Path=/`
      const skoup = createSkoup({ site: 'site_test', debug: true, consent: 'wait' })
      expect(skoup.attribution()?.visitor_id).not.toBe(earlier)

      skoup.consent('granted')
      vi.advanceTimersByTime(1000)
      expect(sentHits(beacon)[0].v).toBe(earlier)
      expect(skoup.attribution()?.visitor_id).toBe(earlier)
      skoup.destroy()
    })

    it('deletes the cookie on denied and measures without it again', () => {
      const skoup = createSkoup({ site: 'site_test', debug: true })
      vi.advanceTimersByTime(1000)
      const granted = sentHits(beacon)[0]
      expect(document.cookie).toContain(COOKIE)

      skoup.consent('denied')
      expect(document.cookie).not.toContain(COOKIE)
      expect(sessionStorage.getItem('skoup_attribution')).toBeNull()
      skoup.event('signup')
      vi.advanceTimersByTime(1000)

      const denied = sentHits(beacon)[1]
      expect(denied.c).toBe(0)
      expect(denied.d).toBeUndefined()
      // Never the cookie's id once refused.
      expect(denied.v).not.toBe(granted.v)
      expect(document.cookie).not.toContain(COOKIE)
      skoup.destroy()
    })
  })

  describe('off (the visitor objects)', () => {
    it('sends nothing, drops the queue and the cookie, until lifted', () => {
      const skoup = createSkoup({ site: 'site_test', debug: true })
      skoup.event('signup')
      expect(document.cookie).toContain(COOKIE)

      skoup.consent('off')
      skoup.event('demo')
      window.history.pushState({}, '', '/pricing')
      vi.advanceTimersByTime(1000)
      expect(beacon).not.toHaveBeenCalled()
      expect(document.cookie).not.toContain(COOKIE)
      expect(sessionStorage.length).toBe(0)
      expect(skoup.attribution()).toBeNull()

      skoup.consent('wait')
      skoup.event('demo')
      vi.advanceTimersByTime(1000)
      const [hit] = sentHits(beacon)
      expect(hit.c).toBe(0)
      expect(hit.e.map((e) => e.n)).toEqual(['demo'])
      skoup.destroy()
    })

    it('sends nothing from the start', () => {
      const skoup = createSkoup({ site: 'site_test', debug: true, consent: 'off' })
      skoup.event('signup')
      vi.advanceTimersByTime(1000)
      expect(beacon).not.toHaveBeenCalled()
      expect(document.cookie).toBe('')
      skoup.destroy()
    })
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
