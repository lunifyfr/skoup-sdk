import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

/** The tag booted on a WooCommerce page, as `<script data-site [data-skoup-order]>` would. */
async function boot(url: string, order?: string, consent?: string): Promise<string[]> {
  window.history.replaceState(null, '', url)
  const script = document.createElement('script')
  script.setAttribute('data-site', 'site_shop')
  script.setAttribute('data-endpoint', 'https://collector.test/t')
  if (order !== undefined) script.setAttribute('data-skoup-order', order)
  if (consent !== undefined) script.setAttribute('data-consent', consent)
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
    .map((e: { o?: string }) => e.o ?? '(no order)')
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
    expect(sessionStorage.getItem('skoup_order_1046')).toBe('1')
  })

  it('still sends when the storage is blocked', async () => {
    const spy = vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('blocked')
    })
    expect(await boot('/merci/', '1047')).toEqual(['1047'])
    spy.mockRestore()
  })

  it('without the cookie: the purchase without its order, nothing in sessionStorage', async () => {
    expect(await boot('/merci/', '1048', 'wait')).toEqual(['(no order)'])
    expect(sessionStorage.length).toBe(0)
  })

  it('sends nothing when the visitor objects', async () => {
    expect(await boot('/merci/', '1049', 'off')).toEqual([])
  })

  describe('with the purchase also sent to Google Analytics', () => {
    const layer = window as unknown as { dataLayer?: unknown[] }
    const purchases = () =>
      vi
        .mocked(window.fetch)
        .mock.calls.flatMap(([, init]) => JSON.parse((init as { body: string }).body).e)
        .filter((e: { n?: string }) => e.n === 'purchase')

    beforeEach(() => {
      // GA4 on the thank-you page, pushed before the deferred tag runs.
      delete layer.dataLayer
      layer.dataLayer = [
        { event: 'purchase', ecommerce: { transaction_id: '1050', value: 89, currency: 'EUR' } },
      ]
    })

    afterEach(() => {
      delete layer.dataLayer
    })

    it('one purchase, with the order and the amount GA4 had', async () => {
      await boot('/checkout/order-received/1050/?key=wc_order_abc123')
      vi.advanceTimersByTime(3000)
      expect(purchases()).toEqual([expect.objectContaining({ o: '1050', val: 89, cur: 'EUR' })])
    })

    it('none on a reload of the page', async () => {
      await boot('/checkout/order-received/1050/?key=wc_order_abc123')
      delete layer.dataLayer
      layer.dataLayer = [
        { event: 'purchase', ecommerce: { transaction_id: '1050', value: 89, currency: 'EUR' } },
      ]
      await boot('/checkout/order-received/1050/?key=wc_order_abc123')
      vi.advanceTimersByTime(3000)
      expect(purchases()).toEqual([])
    })

    it('without the cookie: one purchase, its amount, no order', async () => {
      await boot('/checkout/order-received/1050/?key=wc_order_abc123', undefined, 'wait')
      vi.advanceTimersByTime(3000)
      const sent = purchases()
      expect(sent).toEqual([expect.objectContaining({ val: 89, cur: 'EUR' })])
      expect(sent[0]).not.toHaveProperty('o')
      expect(sessionStorage.length).toBe(0)
    })
  })

  it('ignores an invalid id', async () => {
    expect(await boot('/merci/', '12a')).toEqual([])
    expect(await boot('/merci/', '123456789012345678901')).toEqual([])
    expect(await boot('/?order-received=abc&key=wc_order_abc123')).toEqual([])
  })
})
