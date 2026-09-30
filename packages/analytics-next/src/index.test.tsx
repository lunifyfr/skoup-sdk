import { act, render } from '@testing-library/react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const navigation = { pathname: '/', search: new URLSearchParams('') }
vi.mock('next/navigation', () => ({
  usePathname: () => navigation.pathname,
  useSearchParams: () => navigation.search,
}))

import { SkoupAnalytics, useSkoup } from './index'

type Sent = { e: Array<{ t: string; n?: string; u?: string }> }
const sent = (): Sent[] =>
  vi.mocked(window.fetch).mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  window.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  ) as unknown as typeof fetch
  navigation.pathname = '/'
  navigation.search = new URLSearchParams('')
})

describe('SkoupAnalytics', () => {
  it('reports a page view per pathname change, from the root layout', () => {
    function Child() {
      const skoup = useSkoup()
      return <button onClick={() => skoup.event('signup')}>signup</button>
    }
    const { rerender, getByText } = render(
      <SkoupAnalytics site="site_next" debug>
        <Child />
      </SkoupAnalytics>,
    )
    navigation.pathname = '/pricing'
    navigation.search = new URLSearchParams('utm_source=chatgpt.com')
    rerender(
      <SkoupAnalytics site="site_next" debug>
        <Child />
      </SkoupAnalytics>,
    )
    act(() => getByText('signup').click())
    act(() => vi.advanceTimersByTime(1000))

    const events = sent()[0].e
    expect(events.filter((e) => e.t === 'pageview')).toHaveLength(2)
    expect(events[events.length - 1]).toMatchObject({ t: 'event', n: 'signup' })
  })
})
