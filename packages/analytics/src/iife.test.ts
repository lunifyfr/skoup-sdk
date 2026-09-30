import { beforeEach, describe, expect, it, vi } from 'vitest'

/** The browser tag, booted as `<script data-site data-consent="wait" data-debug>` would. */
describe('the tag', () => {
  beforeEach(() => {
    vi.resetModules()
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
    window.fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    ) as unknown as typeof fetch
    document.cookie = 'skp_vid=; Max-Age=0; Path=/'
    sessionStorage.clear()
    delete window.skoup
  })

  it('reads its attributes, replays the queued calls and exposes window.skoup', async () => {
    const script = document.createElement('script')
    script.setAttribute('data-site', 'site_tag')
    script.setAttribute('data-endpoint', 'https://collector.test/t')
    script.setAttribute('data-consent', 'wait')
    script.setAttribute('data-debug', '1')
    Object.defineProperty(document, 'currentScript', { value: script, configurable: true })
    // Calls made before the tag loaded, as the snippet queues them.
    const queued = function () {} as unknown as NonNullable<Window['skoup']>
    queued.q = [['event', 'signup', { plan: 'growth' }]]
    window.skoup = queued

    await import('./iife')

    expect(window.skoup?.loaded).toBe(true)
    window.skoup?.('event', 'purchase', null, { value: 10, currency: 'EUR', order_id: '1' })
    vi.advanceTimersByTime(1000)

    const sent = vi.mocked(window.fetch).mock.calls
    expect(sent[0][0]).toBe('https://collector.test/t')
    const body = JSON.parse((sent[0][1] as { body: string }).body)
    expect(body.s).toBe('site_tag')
    expect(body.e.map((e: { t: string; n?: string }) => e.n ?? e.t)).toEqual([
      'pageview',
      'signup',
      'purchase',
    ])
    // consent=wait: no cookie until granted
    expect(document.cookie).not.toContain('skp_vid')
    window.skoup?.('consent', 'granted')
    expect(document.cookie).toContain('skp_vid=' + body.v)
    expect(window.skoup?.attribution()?.visitor_id).toBe(body.v)
  })

  it('is inert without a site key', async () => {
    Object.defineProperty(document, 'currentScript', { value: null, configurable: true })
    await import('./iife')
    window.skoup?.('event', 'signup')
    vi.advanceTimersByTime(1000)
    expect(window.fetch).not.toHaveBeenCalled()
    expect(window.skoup?.attribution()).toBeNull()
  })
})

describe('proxiedEndpoint', () => {
  it('derives the collector from the tag served through a first-party proxy', async () => {
    const { proxiedEndpoint } = await import('./iife')
    expect(proxiedEndpoint('https://www.nordvelo.fr/_skoup/t.js', ['app.skoup.ai'])).toBe(
      'https://www.nordvelo.fr/_skoup/t',
    )
    // Served by Skoup itself: the baked collector.
    expect(proxiedEndpoint('https://app.skoup.ai/t.js', ['app.skoup.ai'])).toBeUndefined()
    expect(proxiedEndpoint('https://cdn.example/skoup.iife.js', ['app.skoup.ai'])).toBeUndefined()
    expect(proxiedEndpoint(null, ['app.skoup.ai'])).toBeUndefined()
  })
})
