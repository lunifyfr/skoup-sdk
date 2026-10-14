import { conversionFor, type SkoupConversion } from './conversions'

/**
 * Reads the conversions the site sends to Google Analytics 4 from
 * `window.dataLayer` — where `gtag()` pushes its `arguments` and Google
 * Tag Manager its `{ event, … }` objects. See `./conversions` for what is
 * taken and what never is.
 */

/** A conversion read from the `dataLayer`: its Skoup name, and for a purchase what joins it to the order. */
export interface DataLayerConversion {
  name: SkoupConversion
  value?: number
  currency?: string
  order_id?: string
}

type Bag = Record<string, unknown>

const isBag = (value: unknown): value is Bag => typeof value === 'object' && value !== null

const isArguments = (value: unknown): value is ArrayLike<unknown> =>
  Object.prototype.toString.call(value) === '[object Arguments]'

function amount(value: unknown): number | undefined {
  const number = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof number === 'number' && Number.isFinite(number) ? number : undefined
}

function currency(value: unknown): string | undefined {
  return typeof value === 'string' && /^[A-Za-z]{3}$/.test(value.trim())
    ? value.trim().toUpperCase()
    : undefined
}

function orderId(value: unknown): string | undefined {
  const id =
    typeof value === 'string' ? value.trim() : typeof value === 'number' ? String(value) : ''
  return id && id.length <= 128 ? id : undefined
}

/**
 * The conversion carried by one `dataLayer` entry — `gtag('event', name,
 * params)` (an `arguments` object) or `{ event: name, ecommerce?: {…} }`
 * (Google Tag Manager) — or null for anything else. Only the name leaves,
 * plus the amount, currency and order id of a `purchase`.
 */
export function conversionFromDataLayer(entry: unknown): DataLayerConversion | null {
  let ga4Name: unknown
  let read: (key: string) => unknown
  if (isArguments(entry)) {
    if (entry[0] !== 'event') return null
    ga4Name = entry[1]
    const params = isBag(entry[2]) ? entry[2] : {}
    read = (key) => params[key]
  } else if (isBag(entry)) {
    ga4Name = entry.event
    const ecommerce = isBag(entry.ecommerce) ? entry.ecommerce : {}
    read = (key) => ecommerce[key] ?? entry[key]
  } else return null

  const name = conversionFor(ga4Name)
  if (!name) return null
  if (name !== 'purchase') return { name }
  const conversion: DataLayerConversion = { name }
  const value = amount(read('value'))
  const cur = currency(read('currency'))
  const order = orderId(read('transaction_id'))
  if (value !== undefined) conversion.value = value
  if (cur) conversion.currency = cur
  if (order) conversion.order_id = order
  return conversion
}

/** Entries already read — shared by every instance, so a re-created one never counts them twice. */
const seen = new WeakSet<object>()

/**
 * Calls `onConversion` for each conversion of `window.dataLayer`: the
 * entries already there, then every one pushed after — `push` is wrapped
 * and still calls the one it found (Google Tag Manager and gtag.js chain
 * theirs the same way). A `dataLayer` created or replaced after the call
 * is followed too (an accessor on `window`), unless the site declared it
 * with `var` before (it then cannot be redefined: only that array is
 * followed). Returns the function that stops listening and puts back what
 * it can. Never throws into the site's code.
 */
export function watchDataLayer(
  w: Window,
  onConversion: (conversion: DataLayerConversion) => void,
): () => void {
  const host = w as unknown as Record<string, unknown>
  let stopped = false
  const arrays: Array<{
    array: unknown[]
    original: unknown[]['push']
    own: boolean
    wrapper: unknown[]['push']
  }> = []

  const handle = (entry: unknown): void => {
    if (stopped || !isBag(entry) || seen.has(entry)) return
    seen.add(entry)
    try {
      const conversion = conversionFromDataLayer(entry)
      if (conversion) onConversion(conversion)
    } catch {
      /* never break the site's dataLayer */
    }
  }

  const attach = (value: unknown): void => {
    if (!Array.isArray(value) || arrays.some((each) => each.array === value)) return
    const array = value as unknown[]
    const original = array.push
    const own = Object.prototype.hasOwnProperty.call(array, 'push')
    const wrapper = function (this: unknown[], ...items: unknown[]): number {
      const result = original.apply(this, items)
      for (const item of items) handle(item)
      return result
    }
    arrays.push({ array, original, own, wrapper })
    for (const entry of array.slice()) handle(entry)
    array.push = wrapper
  }

  let current = host.dataLayer
  attach(current)

  // Created or replaced later (`window.dataLayer = window.dataLayer || []`): followed.
  const getter = () => current
  const descriptor = Object.getOwnPropertyDescriptor(w, 'dataLayer')
  let accessor = false
  if (!descriptor || (descriptor.configurable && descriptor.writable && 'value' in descriptor)) {
    try {
      Object.defineProperty(w, 'dataLayer', {
        configurable: true,
        enumerable: true,
        get: getter,
        set: (value: unknown) => {
          current = value
          attach(value)
        },
      })
      accessor = true
    } catch {
      /* another script owns the property: the array of now only */
    }
  }

  return () => {
    stopped = true
    for (const { array, original, own, wrapper } of arrays) {
      // Wrapped again by a script loaded after: ours stays in its chain, inert.
      if (array.push !== wrapper) continue
      if (own) array.push = original
      else delete (array as { push?: unknown }).push
    }
    if (accessor && Object.getOwnPropertyDescriptor(w, 'dataLayer')?.get === getter) {
      Object.defineProperty(w, 'dataLayer', {
        configurable: true,
        enumerable: true,
        writable: true,
        value: current,
      })
    }
  }
}
