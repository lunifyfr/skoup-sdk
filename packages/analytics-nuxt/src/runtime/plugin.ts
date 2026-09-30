import type { App } from 'vue'
import type { Router } from 'vue-router'
import { createSkoupPlugin } from '@skoup/analytics-vue'
import type { SkoupOptions } from '@skoup/analytics'
// Nuxt's own composables — resolved by Nuxt when the plugin runs.
// @ts-expect-error nuxt alias
import { defineNuxtPlugin, useRuntimeConfig } from '#app'

interface NuxtAppLike {
  vueApp: App
  $router?: Router
}

export default defineNuxtPlugin((nuxtApp: NuxtAppLike) => {
  const options = (useRuntimeConfig().public.skoup ?? {}) as SkoupOptions
  if (!options.site) return
  nuxtApp.vueApp.use(createSkoupPlugin({ ...options, router: nuxtApp.$router }))
})
