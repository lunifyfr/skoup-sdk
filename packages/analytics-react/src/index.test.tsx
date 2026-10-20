import { act, render, screen } from '@testing-library/react'
import { useState } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import { SkoupProvider, useSkoup, useSkoupEvent, useSkoupPageview } from './index'

type Sent = { e: Array<{ t: string; n?: string; u?: string; r?: string }> }
const sent = (): Sent[] =>
  vi.mocked(window.fetch).mock.calls.map(([, init]) => JSON.parse((init as { body: string }).body))

beforeEach(() => {
  vi.useFakeTimers()
  Object.defineProperty(window.navigator, 'sendBeacon', { value: undefined, configurable: true })
  window.fetch = vi.fn(() =>
    Promise.resolve(new Response(null, { status: 204 })),
  ) as unknown as typeof fetch
  window.history.replaceState({}, '', '/')
  Object.defineProperty(document, 'referrer', { value: '', configurable: true })
})

describe('SkoupProvider', () => {
  it('creates one instance, sends the first page view and the events of the hooks', () => {
    function Button() {
      const skoup = useSkoup()
      const signup = useSkoupEvent('signup')
      return (
        <>
          <button onClick={() => signup({ plan: 'growth' })}>signup</button>
          <button onClick={() => skoup.event('demo')}>demo</button>
        </>
      )
    }
    const { unmount } = render(
      <SkoupProvider site="site_react" debug>
        <Button />
      </SkoupProvider>,
    )
    act(() => screen.getByText('signup').click())
    act(() => screen.getByText('demo').click())
    act(() => vi.advanceTimersByTime(1000))

    expect(sent()).toHaveLength(1)
    expect(sent()[0].e.map((e) => e.n ?? e.t)).toEqual(['pageview', 'signup', 'demo'])
    unmount()
  })

  it('reports pages through useSkoupPageview when the router is not observable', () => {
    Object.defineProperty(document, 'referrer', {
      value: 'https://chatgpt.com/',
      configurable: true,
    })
    function Routed() {
      const [path, setPath] = useState('/a')
      useSkoupPageview(path)
      return <button onClick={() => setPath('/b')}>go</button>
    }
    render(
      <SkoupProvider site="site_react" debug autoPageview={false} trackHistory={false}>
        <Routed />
      </SkoupProvider>,
    )
    act(() => screen.getByText('go').click())
    act(() => vi.advanceTimersByTime(1000))

    // The first page keeps where the visit came from, the next one is internal.
    const pages = sent()[0].e.filter((e) => e.t === 'pageview')
    expect(pages.map((e) => e.r)).toEqual(['https://chatgpt.com/', undefined])
  })

  it('passes the consent through: without a cookie, then with it', () => {
    // The cookie the providers above set.
    document.cookie = 'skp_vid=; Max-Age=0; Path=/'
    let skoup: ReturnType<typeof useSkoup> | null = null
    function Grab() {
      skoup = useSkoup()
      return null
    }
    render(
      <SkoupProvider site="site_react" debug consent="wait">
        <Grab />
      </SkoupProvider>,
    )
    act(() => vi.advanceTimersByTime(1000))
    expect((sent()[0] as Sent & { c?: number }).c).toBe(0)
    expect(document.cookie).not.toContain('skp_vid')

    act(() => skoup!.consent('granted'))
    expect(document.cookie).toContain('skp_vid=')
  })

  it('is a no-op outside of a provider', () => {
    function Lone() {
      const skoup = useSkoup()
      skoup.event('signup')
      return null
    }
    render(<Lone />)
    act(() => vi.advanceTimersByTime(1000))
    expect(window.fetch).not.toHaveBeenCalled()
  })
})
