import { createApp } from 'vue'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const runtime = { public: { skoup: { site: 'site_nuxt', debug: true } as Record<string, unknown> } }
vi.mock('#app', () => ({
  defineNuxtPlugin: (plugin: unknown) => plugin,
  useRuntimeConfig: () => runtime,
}))

import plugin from './plugin'

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  window.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  ) as unknown as typeof fetch
})

describe('the client plugin', () => {
  it('installs the vue plugin with the router: a page view after each navigation', () => {
    const after: Array<() => void> = []
    const nuxtApp = {
      vueApp: createApp({ render: () => null }),
      $router: { afterEach: (fn: () => void) => after.push(fn) },
    }
    ;(plugin as unknown as (app: unknown) => void)(nuxtApp)

    after.forEach((fn) => fn())
    after.forEach((fn) => fn())
    vi.advanceTimersByTime(1000)

    const body = JSON.parse((vi.mocked(window.fetch).mock.calls[0][1] as { body: string }).body)
    expect(body.s).toBe('site_nuxt')
    expect(body.e.filter((e: { t: string }) => e.t === 'pageview')).toHaveLength(2)
  })

  it('does nothing without a site key', () => {
    runtime.public.skoup = {}
    const nuxtApp = { vueApp: createApp({ render: () => null }) }
    ;(plugin as unknown as (app: unknown) => void)(nuxtApp)
    vi.advanceTimersByTime(1000)
    expect(window.fetch).not.toHaveBeenCalled()
  })
})
