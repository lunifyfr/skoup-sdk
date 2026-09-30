import { createSkoup, noopSkoup, type ConsentState, type Skoup } from './index'

/**
 * The browser build: `<script defer src="…/skoup.iife.js" data-site="site_…"></script>`.
 * Exposes `window.skoup(command, …)` — `('event', name, props, extra)`,
 * `('pageview')`, `('consent', state)` — and `window.skoup.attribution()`.
 * Calls queued before the load (`window.skoup.q`) are replayed.
 */
type Command =
  | [
      'event',
      string,
      (Record<string, string | number | boolean> | null)?,
      Parameters<Skoup['event']>[2]?,
    ]
  | ['pageview']
  | ['consent', ConsentState]
type Global = ((...args: Command) => void) & {
  attribution: Skoup['attribution']
  loaded: boolean
  q?: Command[]
}

declare global {
  interface Window {
    skoup?: Global
    __SKOUP_ENDPOINT__?: string
  }
}

;(function boot(w: Window) {
  if (w.skoup && w.skoup.loaded) return
  const script = w.document.currentScript as HTMLScriptElement | null
  const site = script?.getAttribute('data-site') ?? ''
  const endpoint = script?.getAttribute('data-endpoint') ?? w.__SKOUP_ENDPOINT__ ?? undefined
  const consent = (script?.getAttribute('data-consent') as ConsentState | null) ?? 'granted'
  const debug = Boolean(script?.getAttribute('data-debug'))
  const cookieDomain = script?.getAttribute('data-cookie-domain') ?? undefined

  const instance = site
    ? createSkoup({ site, endpoint, consent, debug, cookieDomain }, w)
    : noopSkoup()

  const pending = w.skoup?.q ?? []
  const skoup = ((...args: Command): void => {
    if (args[0] === 'event') instance.event(args[1], args[2] ?? null, args[3])
    else if (args[0] === 'pageview') instance.pageview()
    else if (args[0] === 'consent') instance.consent(args[1])
  }) as Global
  skoup.attribution = () => instance.attribution()
  skoup.loaded = true
  w.skoup = skoup
  for (const call of pending) skoup(...call)
})(window)
