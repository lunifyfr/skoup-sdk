import { createSkoup, noopSkoup, type ConsentState, type Skoup } from './index'

/**
 * The browser build: `<script defer src="…/skoup.iife.js" data-site="site_…"></script>`.
 * Exposes `window.skoup(command, …)` — `('event', name, props, extra)`,
 * `('pageview')`, `('consent', state)` — and `window.skoup.attribution()`.
 * Calls queued before the load (`window.skoup.q`) are replayed.
 *
 * Served through a first-party proxy (`https://brand.com/_skoup/t.js`),
 * the hits go to the same path with `t` in place of `t.js`
 * (`https://brand.com/_skoup/t`): nothing to declare, like Sentry's
 * tunnel. `data-endpoint` still overrides.
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
    /** The collector, set by the host serving the tag (`app.skoup.ai/t.js`). */
    __SKOUP_ENDPOINT__?: string
    /** The hosts serving the tag directly; any other host is a first-party proxy. */
    __SKOUP_SCRIPT_HOSTS__?: string[]
  }
}

/** `https://brand.com/_skoup/t.js` → `https://brand.com/_skoup/t`, when the tag is not served by Skoup itself. */
export function proxiedEndpoint(
  src: string | null | undefined,
  skoupHosts: string[] | undefined,
): string | undefined {
  if (!src) return undefined
  try {
    const url = new URL(src)
    if ((skoupHosts ?? []).includes(url.hostname)) return undefined
    if (!/\/t\.js$/.test(url.pathname)) return undefined
    return url.origin + url.pathname.replace(/\/t\.js$/, '/t')
  } catch {
    return undefined
  }
}

;(function boot(w: Window) {
  if (w.skoup && w.skoup.loaded) return
  const script = w.document.currentScript as HTMLScriptElement | null
  const site = script?.getAttribute('data-site') ?? ''
  const endpoint =
    script?.getAttribute('data-endpoint') ??
    proxiedEndpoint(script?.src, w.__SKOUP_SCRIPT_HOSTS__) ??
    w.__SKOUP_ENDPOINT__ ??
    undefined
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
