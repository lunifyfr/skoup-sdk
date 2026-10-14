import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { GA4_CONVERSIONS, createSkoup, type Skoup } from './index'
import { conversionFromDataLayer } from './gtag'

type Layer = unknown[]
const host = window as unknown as { dataLayer?: Layer }

/** The site's gtag snippet: `function gtag(){dataLayer.push(arguments)}`. */
function gtag(..._args: unknown[]): void {
  // eslint-disable-next-line prefer-rest-params
  host.dataLayer!.push(arguments)
}

const fetchMock = () => vi.mocked(window.fetch)
type Body = { c?: number; e: Array<Record<string, unknown>> }
const bodies = (): Body[] =>
  fetchMock().mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))
/** The named events sent, after the hold and the batch. */
const events = (): Array<Record<string, unknown>> => {
  vi.advanceTimersByTime(3000)
  return bodies()
    .flatMap((body) => body.e)
    .filter((e) => e.t === 'event')
}

let skoup: Skoup | null = null
const start = (options: Partial<Parameters<typeof createSkoup>[0]> = {}): Skoup =>
  (skoup = createSkoup({ site: 'site_test', debug: true, ...options }))

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  window.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  ) as unknown as typeof fetch
  document.cookie = 'skp_vid=; Max-Age=0; Path=/'
  document.cookie = 'skp_vid=; Max-Age=0; Path=/; Domain=nordvelo.fr'
  sessionStorage.clear()
  delete host.dataLayer
})

afterEach(() => {
  skoup?.destroy()
  skoup = null
  delete host.dataLayer
  vi.useRealTimers()
})

describe('the conversions sent to Google Analytics', () => {
  it('takes a gtag purchase: amount, currency and order, never the other parameters', () => {
    host.dataLayer = []
    start()
    gtag('event', 'purchase', {
      value: 129.9,
      currency: 'eur',
      transaction_id: 'T-1042',
      email: 'jane@example.com',
      items: [{ item_name: 'Strade 7' }],
    })

    expect(events()).toEqual([
      { t: 'event', n: 'purchase', val: 129.9, cur: 'EUR', o: 'T-1042', ts: expect.any(Number) },
    ])
    expect(JSON.stringify(bodies())).not.toContain('jane@example.com')
    expect(JSON.stringify(bodies())).not.toContain('Strade 7')
  })

  it('takes a Google Tag Manager lead by its Skoup name, without its properties', () => {
    host.dataLayer = []
    start()
    host.dataLayer!.push({ event: 'generate_lead', form_text: 'Rappelez-moi au 06 12 34 56 78' })

    const [lead] = events()
    expect(lead).toMatchObject({ t: 'event', n: 'lead' })
    expect(lead).not.toHaveProperty('p')
    expect(JSON.stringify(bodies())).not.toContain('06 12')
  })

  it('reads the ecommerce object of a Google Tag Manager purchase', () => {
    host.dataLayer = [{ ecommerce: null }]
    start()
    host.dataLayer!.push({
      event: 'purchase',
      ecommerce: { transaction_id: 1043, value: '59.00', currency: 'EUR', coupon: 'JANE10' },
    })
    expect(events()).toMatchObject([{ n: 'purchase', val: 59, cur: 'EUR', o: '1043' }])
  })

  it('maps the table and ignores what is not a conversion', () => {
    host.dataLayer = []
    start()
    gtag('js', new Date())
    gtag('config', 'G-XXXX')
    gtag('consent', 'update', { analytics_storage: 'granted' })
    gtag('event', 'page_view')
    gtag('event', 'add_to_cart', { value: 10 })
    gtag('event', 'begin_checkout', { value: 10 })
    host.dataLayer!.push({ event: 'gtm.js' }, { event: 'view_item' }, ['event', 'sign_up'])
    host.dataLayer!.push({ event: 'constructor' }, 'purchase', null)
    expect(events()).toEqual([])

    vi.advanceTimersByTime(5000)
    gtag('event', 'sign_up', { method: 'google' })
    vi.advanceTimersByTime(5000)
    gtag('event', 'book_appointment')
    vi.advanceTimersByTime(5000)
    host.dataLayer!.push({ event: 'click_to_call' })
    vi.advanceTimersByTime(5000)
    host.dataLayer!.push({ event: 'Contact' })
    expect(events().map((e) => e.n)).toEqual(['signup', 'booking', 'call_click', 'contact'])
    expect(GA4_CONVERSIONS.submit_form).toBe('lead')
  })

  it('takes the entries pushed before the script loaded', () => {
    host.dataLayer = []
    gtag('event', 'sign_up')
    start()
    expect(events().map((e) => e.n)).toEqual(['signup'])
  })

  it('follows a dataLayer created or replaced after the script', () => {
    start()
    host.dataLayer = host.dataLayer || []
    gtag('event', 'generate_lead')
    vi.advanceTimersByTime(5000)
    host.dataLayer = [{ event: 'sign_up' }]
    expect(events().map((e) => e.n)).toEqual(['lead', 'signup'])
  })

  it('keeps the dataLayer working for Google Tag Manager, and puts it back on destroy', () => {
    host.dataLayer = []
    start()
    // GTM loads after Skoup and wraps push in turn, calling the one it found.
    const seenByGtm: unknown[] = []
    const ours = host.dataLayer!.push
    host.dataLayer!.push = function (this: Layer, ...items: unknown[]) {
      seenByGtm.push(...items)
      return ours.apply(this, items)
    }
    expect(host.dataLayer!.push({ event: 'generate_lead' })).toBe(1)
    expect(host.dataLayer).toHaveLength(1)
    expect(seenByGtm).toHaveLength(1)
    expect(events().map((e) => e.n)).toEqual(['lead'])

    const plain: Layer = []
    host.dataLayer = plain
    skoup!.destroy()
    skoup = null
    expect(Object.prototype.hasOwnProperty.call(plain, 'push')).toBe(false)
    expect(Object.getOwnPropertyDescriptor(window, 'dataLayer')).toMatchObject({ value: plain })
    plain.push({ event: 'generate_lead' })
    expect(events().map((e) => e.n)).toEqual(['lead'])
  })

  it('is off with captureGtag: false', () => {
    host.dataLayer = [{ event: 'sign_up' }]
    start({ captureGtag: false })
    gtag('event', 'purchase', { value: 1, currency: 'EUR' })
    expect(events()).toEqual([])
    expect(Object.prototype.hasOwnProperty.call(host.dataLayer, 'push')).toBe(false)
  })

  describe('consent', () => {
    it('sends nothing when the visitor objects', () => {
      host.dataLayer = []
      start({ consent: 'off' })
      gtag('event', 'purchase', { value: 1, currency: 'EUR', transaction_id: '1' })
      expect(fetchMock()).not.toHaveBeenCalled()
      expect(events()).toEqual([])
    })

    it('drops a held conversion when the visitor objects', () => {
      host.dataLayer = []
      start()
      gtag('event', 'sign_up')
      skoup!.consent('off')
      expect(events()).toEqual([])
    })

    it('without the cookie: the amount, never the order, nothing on the device', () => {
      host.dataLayer = []
      const getItem = vi.spyOn(Storage.prototype, 'getItem')
      start({ consent: 'wait' })
      gtag('event', 'purchase', { value: 49, currency: 'EUR', transaction_id: '1042' })
      const [purchase] = events()
      expect(purchase).toMatchObject({ n: 'purchase', val: 49, cur: 'EUR' })
      expect(purchase).not.toHaveProperty('o')
      expect(bodies()[0].c).toBe(0)
      expect(getItem).not.toHaveBeenCalled()
      expect(sessionStorage.length).toBe(0)
      getItem.mockRestore()
    })
  })

  describe('no double count', () => {
    it('the site reports it first: the Google Analytics one is dropped', () => {
      host.dataLayer = []
      start()
      skoup!.event('lead', { form: 'demo' })
      vi.advanceTimersByTime(300)
      gtag('event', 'generate_lead')
      expect(events()).toMatchObject([{ n: 'lead', p: { form: 'demo' } }])
    })

    it('Google Analytics first: the site’s own replaces it, within the window', () => {
      host.dataLayer = []
      start()
      host.dataLayer!.push({ event: 'sign_up' })
      vi.advanceTimersByTime(500)
      skoup!.event('signup', { plan: 'growth' })
      expect(events()).toEqual([expect.objectContaining({ n: 'signup', p: { plan: 'growth' } })])
    })

    it('gtag and Google Tag Manager both: one', () => {
      host.dataLayer = []
      start()
      gtag('event', 'generate_lead')
      host.dataLayer!.push({ event: 'generate_lead' })
      expect(events().map((e) => e.n)).toEqual(['lead'])
    })

    it('two conversions further apart than the window: two', () => {
      host.dataLayer = []
      start()
      gtag('event', 'generate_lead')
      vi.advanceTimersByTime(5000)
      gtag('event', 'generate_lead')
      expect(events().map((e) => e.n)).toEqual(['lead', 'lead'])
    })

    it('two purchases of different orders in the same second: two', () => {
      host.dataLayer = []
      start()
      gtag('event', 'purchase', { transaction_id: 'A', value: 1, currency: 'EUR' })
      gtag('event', 'purchase', { transaction_id: 'B', value: 2, currency: 'EUR' })
      expect(events().map((e) => e.o)).toEqual(['A', 'B'])
    })

    it('one order is one purchase, however late the second report', () => {
      host.dataLayer = []
      start()
      skoup!.event('purchase', null, { value: 10, currency: 'EUR', order_id: '77' })
      vi.advanceTimersByTime(10_000)
      gtag('event', 'purchase', { transaction_id: '77', value: 10, currency: 'EUR' })
      expect(events()).toHaveLength(1)
    })
  })
})

describe('conversionFromDataLayer', () => {
  it('reads gtag arguments and GTM objects, nothing else', () => {
    const args = (function (..._a: unknown[]) {
      // eslint-disable-next-line prefer-rest-params
      return arguments
    })('event', 'sign_up', { email: 'x@y.z' })
    expect(conversionFromDataLayer(args)).toEqual({ name: 'signup' })
    expect(conversionFromDataLayer({ event: 'purchase', value: 'abc', currency: 'euro' })).toEqual({
      name: 'purchase',
    })
    expect(conversionFromDataLayer(['event', 'sign_up'])).toBeNull()
    expect(conversionFromDataLayer({ event: 'add_to_cart' })).toBeNull()
    expect(conversionFromDataLayer({ event: 'toString' })).toBeNull()
  })
})
