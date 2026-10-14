/**
 * The orders already reported in this tab (`sessionStorage`
 * `skoup_order_{id}`), so a reloaded thank-you page does not count its
 * order twice — the WooCommerce purchase and a purchase taken from
 * Google Analytics share it. Used with the visitor cookie only: without
 * it, nothing is read or written on the device.
 */
const PREFIX = 'skoup_order_'

/** True when this tab already reported the order. False when the storage is blocked. */
export function orderReported(w: Window, id: string): boolean {
  try {
    return w.sessionStorage.getItem(PREFIX + id) !== null
  } catch {
    return false
  }
}

/** Remembers the order for this tab; nothing when the storage is blocked. */
export function rememberOrder(w: Window, id: string): void {
  try {
    w.sessionStorage.setItem(PREFIX + id, '1')
  } catch {
    /* storage blocked: the order may be reported again on a reload */
  }
}
