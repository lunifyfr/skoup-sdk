import { beforeEach, describe, expect, it, vi } from 'vitest'
import { getSkoup, initSkoup, trackPage } from './index'

type Sent = { e: Array<{ t: string; n?: string; r?: string }> }
const sent = (): Sent[] =>
  vi.mocked(window.fetch).mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  window.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  ) as unknown as typeof fetch
})

describe('initSkoup / trackPage', () => {
  it('is a no-op before init, then reports the pages SvelteKit navigates to', () => {
    getSkoup().event('signup')
    vi.advanceTimersByTime(1000)
    expect(window.fetch).not.toHaveBeenCalled()

    initSkoup({ site: 'site_svelte', debug: true, autoPageview: false, trackHistory: false })
    trackPage()
    window.history.pushState({}, '', '/pricing')
    trackPage()
    getSkoup().event('demo_request')
    vi.advanceTimersByTime(1000)

    const events = sent()[0].e
    expect(events.filter((e) => e.t === 'pageview')).toHaveLength(2)
    expect(events[events.length - 1]).toMatchObject({ t: 'event', n: 'demo_request' })
  })
})
