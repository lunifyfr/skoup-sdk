import { describe, expect, it, vi } from 'vitest'

const { addPlugin } = vi.hoisted(() => ({ addPlugin: vi.fn() }))
vi.mock('@nuxt/kit', () => ({
  addPlugin,
  createResolver: () => ({ resolve: (path: string) => `/resolved/${path}` }),
  defineNuxtModule: (definition: {
    setup: (options: unknown, nuxt: unknown) => void
    defaults: unknown
  }) => definition,
}))

import module from './index'

describe('the nuxt module', () => {
  it('exposes the options to the client plugin through the public runtime config', () => {
    const nuxt = { options: { runtimeConfig: { public: {} as Record<string, unknown> } } }
    ;(module as unknown as { setup: (options: unknown, nuxt: unknown) => void }).setup(
      { site: 'site_nuxt', consent: 'wait' },
      nuxt,
    )

    expect(nuxt.options.runtimeConfig.public.skoup).toEqual({ site: 'site_nuxt', consent: 'wait' })
    expect(addPlugin).toHaveBeenCalledWith({ src: '/resolved/./runtime/plugin', mode: 'client' })
  })
})
