/**
 * The conversions Skoup takes from what the site already sends to Google
 * Analytics 4 (`gtag('event', name, params)`, or `dataLayer.push({ event:
 * name, … })` with Google Tag Manager) — so a site measured by GA4 counts
 * its conversions in Skoup without a line of code (`captureGtag`, on by
 * default).
 *
 * Only the events of this table are taken; every other one (page views,
 * `view_item`, `add_to_cart`, `begin_checkout`… — steps, not conversions,
 * and the Shopify pixel already has them) is ignored. Of an event taken,
 * only its Skoup name leaves — never its parameters, which may hold an
 * e-mail, a name or a typed text — except, for a `purchase`, its amount
 * (`value`), currency (`currency`) and order id (`transaction_id`, sent as
 * `order_id`, with the visitor cookie only).
 *
 * The GA4 name is matched without regard to case.
 */
export const GA4_CONVERSIONS = {
  // GA4 recommended events
  purchase: 'purchase',
  generate_lead: 'lead',
  sign_up: 'signup',
  // Appointments
  book_appointment: 'booking',
  booking: 'booking',
  appointment: 'booking',
  schedule: 'booking',
  // Calls
  phone_call: 'call_click',
  click_to_call: 'call_click',
  call: 'call_click',
  // Contact and forms
  contact: 'contact',
  form_submit: 'lead',
  submit_form: 'lead',
} as const satisfies Record<string, string>

/** A GA4 event name Skoup takes as a conversion. */
export type Ga4ConversionName = keyof typeof GA4_CONVERSIONS
/** The Skoup event a GA4 conversion is counted as. */
export type SkoupConversion = (typeof GA4_CONVERSIONS)[Ga4ConversionName]

/** The Skoup name of a GA4 event, or null when it is not a conversion. */
export function conversionFor(ga4Name: unknown): SkoupConversion | null {
  if (typeof ga4Name !== 'string') return null
  const name = ga4Name.trim().toLowerCase()
  return Object.prototype.hasOwnProperty.call(GA4_CONVERSIONS, name)
    ? GA4_CONVERSIONS[name as Ga4ConversionName]
    : null
}
