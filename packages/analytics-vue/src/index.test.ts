import { mount } from '@vue/test-utils'
import { defineComponent, h } from 'vue'
import { createMemoryHistory, createRouter } from 'vue-router'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { createSkoupPlugin, useSkoup } from './index'

type Sent = { e: Array<{ t: string; n?: string; u?: string }> }
const sent = (): Sent[] =>
  vi.mocked(window.fetch).mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  window.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  ) as unknown as typeof fetch
})

const Page = defineComponent({
  setup() {
    const skoup = useSkoup()
    return () => h('button', { onClick: () => skoup.event('signup', { plan: 'growth' }) }, 'signup')
  },
})

describe('createSkoupPlugin', () => {
  it('reports a page view after each navigation and the events of useSkoup', async () => {
    const router = createRouter({
      history: createMemoryHistory(),
      routes: [
        { path: '/', component: Page },
        { path: '/pricing', component: Page },
      ],
    })
    const wrapper = mount(Page, {
      global: { plugins: [router, createSkoupPlugin({ site: 'site_vue', debug: true, router })] },
    })
    // The initial navigation is a page, the next one another.
    await router.isReady()
    await router.push('/pricing')
    await wrapper.find('button').trigger('click')
    vi.advanceTimersByTime(1000)

    const events = sent()[0].e
    expect(events.filter((e) => e.t === 'pageview')).toHaveLength(2)
    expect(events[events.length - 1]).toMatchObject({ t: 'event', n: 'signup' })
    expect(wrapper.vm.$skoup).toBeDefined()
  })

  it('is a no-op without the plugin', () => {
    const wrapper = mount(Page)
    wrapper.find('button').trigger('click')
    vi.advanceTimersByTime(1000)
    expect(window.fetch).not.toHaveBeenCalled()
  })
})
