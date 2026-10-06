import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The tag booted on a WooCommerce page, as `<script data-site [data-skoup-order]>` would. */
async function boot(url: string, order?: string): Promise<string[]> {
  window.history.replaceState(null, '', url)
  const script = document.createElement('script')
  script.setAttribute('data-site', 'site_shop')
  script.setAttribute('data-endpoint', 'https://collector.test/t')
  if (order !== undefined) script.setAttribute('data-skoup-order', order)
  Object.defineProperty(document, 'currentScript', { value: script, configurable: true })
  delete window.skoup
  vi.resetModules()
  vi.mocked(window.fetch).mockClear()
  await import('./iife')
  vi.advanceTimersByTime(1000)
  return vi
    .mocked(window.fetch)
    .mock.calls.flatMap(([, init]) => JSON.parse((init as { body: string }).body).e)
    .filter((e: { n?: string }) => e.n === 'purchase')
    .map((e: { o: string }) => e.o)
}

describe('the WooCommerce purchase', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
    window.fetch = vi.fn(() =>
      Promise.resolve(new Response(null, { status: 204 })),
    ) as unknown as typeof fetch
    sessionStorage.clear()
  })

  afterEach(() => {
    window.history.replaceState(null, '', '/')
  })

  it('takes the order from data-skoup-order', async () => {
    expect(await boot('/merci/', '1042')).toEqual(['1042'])
  })

  it('reads the pretty thank-you URL', async () => {
    expect(await boot('/checkout/order-received/1043/?key=wc_order_abc123')).toEqual(['1043'])
  })

  it('reads the plain-permalink thank-you URL', async () => {
    expect(await boot('/?page_id=7&order-received=1044&key=wc_order_abc123')).toEqual(['1044'])
  })

  it('sends nothing without a wc_order_ key', async () => {
    expect(await boot('/checkout/order-received/1045/')).toEqual([])
    expect(await boot('/checkout/order-received/1045/?key=abc')).toEqual([])
    expect(await boot('/?order-received=1045')).toEqual([])
  })

  it('sends an order once per tab, however often the page reloads', async () => {
    expect(await boot('/checkout/order-received/1046/?key=wc_order_abc123')).toEqual(['1046'])
    expect(await boot('/checkout/order-received/1046/?key=wc_order_abc123')).toEqual([])
    expect(sessionStorage.getItem('skoup_wc_order_1046')).toBe('1')
  })

  it('still sends when the storage is blocked', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(await boot('/merci/', '1047')).toEqual(['1047'])
    spy.mockRestore()
  })

  it('ignores an invalid id', async () => {
    expect(await boot('/merci/', '12a')).toEqual([])
    expect(await boot('/merci/', '123456789012345678901')).toEqual([])
    expect(await boot('/?order-received=abc&key=wc_order_abc123')).toEqual([])
  })
})
