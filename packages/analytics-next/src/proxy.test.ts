// @vitest-environment node
import { NextRequest, type NextFetchEvent } from 'next/server'
import { describe, expect, it, vi } from 'vitest'
import { clientIp, reportAiAgents } from './proxy'

const CHATGPT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

const request = (headers: Record<string, string>) =>
  new NextRequest('https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com', { headers })
const event = () => ({ waitUntil: vi.fn() })
const ok = () =>
  vi.fn(async (_url: string, _init: RequestInit) => new Response(null, { status: 204 }))
const options = { site: 'site_next', secret: 'proxy_secret' }

describe('reportAiAgents', () => {
  it('reports an AI agent in waitUntil, with the first x-forwarded-for hop', async () => {
    const fetch = ok()
    const e = event()
    const started = reportAiAgents(
      request({
        'user-agent': CHATGPT,
        'x-forwarded-for': '20.171.207.1, 10.0.0.1',
        'x-real-ip': '10.0.0.2',
      }),
      e,
      { ...options, fetch },
    )
    expect(started).toBe(true)
    expect(e.waitUntil).toHaveBeenCalledTimes(1)
    expect(await e.waitUntil.mock.calls[0][0]).toBe(true)

    const [url, init] = fetch.mock.calls[0]
    expect(url).toBe('https://api.skoup.ai/t/agents')
    expect((init.headers as Record<string, string>)['X-Skoup-Proxy']).toBe('proxy_secret')
    expect(JSON.parse(init.body as string)).toEqual({
      s: 'site_next',
      e: [
        {
          ua: CHATGPT,
          ip: '20.171.207.1',
          u: 'https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com',
          ts: expect.any(Number),
        },
      ],
    })
  })

  it('does not hold the response: the report runs after the proxy returns', () => {
    let settle: (response: Response) => void = () => {}
    const fetch = vi.fn(() => new Promise<Response>((resolve) => (settle = resolve)))
    const e = event()
    expect(
      reportAiAgents(request({ 'user-agent': CHATGPT, 'x-real-ip': '1.2.3.4' }), e, {
        ...options,
        fetch,
      }),
    ).toBe(true)
    // Returned while the request is still in flight.
    expect(fetch).toHaveBeenCalledTimes(1)
    settle(new Response(null, { status: 204 }))
  })

  it('does nothing for a browser, nor without the site or the secret', () => {
    const fetch = ok()
    const e = event()
    expect(
      reportAiAgents(request({ 'user-agent': CHROME, 'x-real-ip': '1.2.3.4' }), e, {
        ...options,
        fetch,
      }),
    ).toBe(false)
    expect(
      reportAiAgents(request({ 'user-agent': CHATGPT }), e, {
        site: 'site_next',
        secret: undefined,
        fetch,
      }),
    ).toBe(false)
    expect(
      reportAiAgents(request({ 'user-agent': CHATGPT }), e, {
        site: undefined,
        secret: 'x',
        fetch,
      }),
    ).toBe(false)
    expect(e.waitUntil).not.toHaveBeenCalled()
    expect(fetch).not.toHaveBeenCalled()
  })

  it('swallows the errors of the collector', async () => {
    const e = event()
    const fetch = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    reportAiAgents(request({ 'user-agent': CHATGPT, 'x-real-ip': '1.2.3.4' }), e, {
      ...options,
      fetch,
    })
    await expect(e.waitUntil.mock.calls[0][0]).resolves.toBe(false)
  })

  it('fits the signature of a Next proxy', () => {
    // Type-level: a NextRequest and a NextFetchEvent are what it takes.
    const proxy = (req: NextRequest, e: NextFetchEvent): boolean => reportAiAgents(req, e, options)
    expect(typeof proxy).toBe('function')
  })
})

describe('clientIp', () => {
  it('reads x-forwarded-for, then x-real-ip', () => {
    expect(clientIp(new Headers({ 'x-forwarded-for': ' 2a01:cb00::1 , 10.0.0.1' }))).toBe(
      '2a01:cb00::1',
    )
    expect(clientIp(new Headers({ 'x-real-ip': '1.2.3.4' }))).toBe('1.2.3.4')
    expect(clientIp(new Headers())).toBeNull()
  })
})
