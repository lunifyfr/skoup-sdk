import { inject, type App, type InjectionKey } from 'vue'
import type { Router } from 'vue-router'
import { createSkoup, noopSkoup, type Skoup, type SkoupOptions } from '@skoup/analytics'

export const SKOUP_KEY: InjectionKey<Skoup> = Symbol('skoup')

export interface SkoupPluginOptions extends SkoupOptions {
  /** Report a page view after each navigation (the instance then ignores `history`). */
  router?: Router
}

/**
 * `app.use(createSkoupPlugin({ site, router }))` — one instance for the app,
 * page views after each router navigation, `useSkoup()` in any component.
 * On the server (SSR) the instance is a no-op.
 */
export function createSkoupPlugin(options: SkoupPluginOptions) {
  return {
    install(app: App) {
      const { router, ...rest } = options
      const instance =
        typeof window === 'undefined'
          ? noopSkoup()
          : createSkoup({
              ...rest,
              autoPageview: router ? false : rest.autoPageview,
              trackHistory: router ? false : rest.trackHistory,
            })

      if (router) {
        let first = true
        router.afterEach(() => {
          instance.pageview(first ? undefined : null)
          first = false
        })
      }

      app.provide(SKOUP_KEY, instance)
      app.config.globalProperties.$skoup = instance
    },
  }
}

/** The app's instance (a no-op outside of the plugin). */
export function useSkoup(): Skoup {
  return inject(SKOUP_KEY, noopSkoup())
}

declare module 'vue' {
  interface ComponentCustomProperties {
    $skoup: Skoup
  }
}

export type {
  Skoup,
  SkoupOptions,
  Attribution,
  EventExtra,
  EventProperties,
  ConsentState,
} from '@skoup/analytics'
