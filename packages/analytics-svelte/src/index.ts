import { createSkoup, noopSkoup, type Skoup, type SkoupOptions } from '@skoup/analytics'

let instance: Skoup | null = null

/**
 * Creates the app's instance once (`initSkoup` in the root layout, on the
 * client). SvelteKit drives its own navigation: pass `autoPageview: false,
 * trackHistory: false` and call `trackPage()` from `afterNavigate`.
 */
export function initSkoup(options: SkoupOptions): Skoup {
  if (typeof window === 'undefined') return noopSkoup()
  instance?.destroy()
  instance = createSkoup(options)
  return instance
}

/** The app's instance (a no-op before `initSkoup`, or on the server). */
export function getSkoup(): Skoup {
  return instance ?? noopSkoup()
}

let first = true

/** A page view for the current location — from SvelteKit's `afterNavigate`. */
export function trackPage(): void {
  getSkoup().pageview(first ? undefined : null)
  first = false
}

export type {
  Skoup,
  SkoupOptions,
  Attribution,
  EventExtra,
  EventProperties,
  ConsentState,
} from '@skoup/analytics'
