/**
 * WooCommerce: on the "Order received" page, the tag sends the
 * `purchase` of the order on its own — once per order and per tab.
 *
 * The id comes from the tag's `data-skoup-order` (set by the Skoup for
 * WooCommerce plugin, which checks the order key), otherwise from the
 * thank-you URL: `/checkout/order-received/{id}/?key=wc_order_…`, or
 * `?order-received={id}&key=wc_order_…` with plain permalinks.
 */

const ORDER_ID = /^\d{1,20}$/
const STORAGE_PREFIX = 'skoup_wc_order_'

/** The WooCommerce order id of this page, or null when it is not a valid "Order received" page. */
export function wooCommerceOrderId(attribute: string | null | undefined, w: Window): string | null {
  let id = attribute || null
  if (!id) {
    const query = new URLSearchParams(w.location.search)
    const path = w.location.pathname.match(/\/order-received\/(\d+)\/?$/)
    if ((query.get('key') || '').indexOf('wc_order_') === 0) {
      id = path ? path[1] : query.get('order-received')
    }
  }
  return id && ORDER_ID.test(id) ? id : null
}

/**
 * Sends `purchase` with `order_id` through `send` when this page is a
 * WooCommerce "Order received" page not reported yet in this tab
 * (`sessionStorage` key `skoup_wc_order_{id}`). Never throws.
 */
export function trackWooCommercePurchase(
  attribute: string | null | undefined,
  send: (orderId: string) => void,
  w: Window,
): void {
  try {
    const id = wooCommerceOrderId(attribute, w)
    if (!id) return
    const key = STORAGE_PREFIX + id
    try {
      if (w.sessionStorage.getItem(key)) return
      w.sessionStorage.setItem(key, '1')
    } catch {
      /* storage blocked: sent on every load of the page */
    }
    send(id)
  } catch {
    /* never break the store's page */
  }
}
