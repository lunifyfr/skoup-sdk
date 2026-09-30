import { addPlugin, createResolver, defineNuxtModule } from '@nuxt/kit'
import type { NuxtModule } from '@nuxt/schema'
import type { SkoupOptions } from '@skoup/analytics'

export interface ModuleOptions extends Omit<SkoupOptions, 'autoPageview' | 'trackHistory'> {}

/**
 * `modules: ['@skoup/analytics-nuxt']`, `skoup: { site: 'site_…' }` in
 * `nuxt.config`. A client plugin installs the Vue plugin with the router:
 * page views on navigation, `useSkoup()` auto-imported from `@skoup/analytics-vue`.
 */
const module: NuxtModule<ModuleOptions> = defineNuxtModule<ModuleOptions>({
  meta: { name: '@skoup/analytics-nuxt', configKey: 'skoup' },
  defaults: { site: '' },
  setup(options, nuxt) {
    const resolver = createResolver(import.meta.url)
    nuxt.options.runtimeConfig.public.skoup = {
      ...(nuxt.options.runtimeConfig.public.skoup as object),
      ...options,
    }
    addPlugin({ src: resolver.resolve('./runtime/plugin'), mode: 'client' })
  },
})

export default module
