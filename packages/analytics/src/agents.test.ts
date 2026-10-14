// @vitest-environment node
import { afterEach, describe, expect, it, vi } from 'vitest'
import {
  AI_AGENTS,
  DEFAULT_AGENTS_ENDPOINT,
  aiAgentEvent,
  isAiAgent,
  reportAiAgent,
  type FetchLike,
} from './agents'

const CHATGPT =
  'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'
const CHROME =
  'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/141.0.0.0 Safari/537.36'

afterEach(() => {
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('isAiAgent', () => {
  it('recognises the assistants and crawlers of the list', () => {
    expect(isAiAgent(CHATGPT)).toBe(true)
    expect(isAiAgent('Mozilla/5.0 (compatible; Claude-User/1.0; +Claude-User@anthropic.com)')).toBe(
      true,
    )
    expect(isAiAgent('Mozilla/5.0 (compatible; PerplexityBot/1.0)')).toBe(true)
    expect(
      isAiAgent(
        'meta-externalagent/1.1 (+https://developers.facebook.com/docs/sharing/webmasters/crawler)',
      ),
    ).toBe(true)
    expect(
      isAiAgent(
        'Mozilla/5.0 (Macintosh) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 (Applebot/0.1)',
      ),
    ).toBe(true)
    for (const agent of AI_AGENTS) expect(isAiAgent(`Mozilla/5.0 (${agent.token}/1.0)`)).toBe(true)
  })

  it('leaves out browsers and the other bots', () => {
    expect(isAiAgent(CHROME)).toBe(false)
    expect(
      isAiAgent('Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)'),
    ).toBe(false)
    expect(isAiAgent('curl/8.7.1')).toBe(false)
    expect(isAiAgent('')).toBe(false)
    expect(isAiAgent(null)).toBe(false)
    expect(isAiAgent(undefined)).toBe(false)
  })
})

describe('aiAgentEvent', () => {
  it('keeps host, path and query, drops the fragment, cuts the User-Agent', () => {
    expect(
      aiAgentEvent(
        {
          userAgent: 'GPTBot ' + 'x'.repeat(600),
          ip: ' 20.171.207.1 ',
          url: 'https://nordvelo.fr/p/strade-7?color=red#reviews',
          status: 200,
        },
        1_760_000_000_500,
      ),
    ).toEqual({
      ua: ('GPTBot ' + 'x'.repeat(600)).slice(0, 512),
      ip: '20.171.207.1',
      u: 'https://nordvelo.fr/p/strade-7?color=red',
      ts: 1_760_000_000,
      st: 200,
    })
  })

  it('cannot be built without an IP, a User-Agent or an http(s) URL', () => {
    expect(aiAgentEvent({ userAgent: CHATGPT, ip: '', url: 'https://a.fr/' })).toBeNull()
    expect(aiAgentEvent({ userAgent: '', ip: '1.2.3.4', url: 'https://a.fr/' })).toBeNull()
    expect(aiAgentEvent({ userAgent: CHATGPT, ip: '1.2.3.4', url: '/relative' })).toBeNull()
    expect(aiAgentEvent({ userAgent: CHATGPT, ip: '1.2.3.4', url: 'ftp://a.fr/' })).toBeNull()
    expect(
      aiAgentEvent({ userAgent: CHATGPT, ip: '1.2.3.4', url: 'https://a.fr/', status: 42 }),
    ).not.toHaveProperty('st')
  })
})

describe('reportAiAgent', () => {
  const report = {
    site: 'site_abc',
    secret: 'proxy_secret',
    userAgent: CHATGPT,
    ip: '20.171.207.1',
    url: 'https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com',
    status: 200,
  }

  it('posts the contract body with the proxy secret', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    expect(await reportAiAgent({ ...report, fetch })).toBe(true)

    expect(fetch).toHaveBeenCalledTimes(1)
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe(DEFAULT_AGENTS_ENDPOINT)
    expect(url).toBe('https://api.skoup.ai/t/agents')
    expect(init.method).toBe('POST')
    expect(init.headers).toEqual({
      'Content-Type': 'application/json',
      'X-Skoup-Proxy': 'proxy_secret',
    })
    const body = JSON.parse(init.body as string)
    expect(body).toEqual({
      s: 'site_abc',
      e: [
        {
          ua: CHATGPT,
          ip: '20.171.207.1',
          u: 'https://nordvelo.fr/products/strade-7?utm_source=chatgpt.com',
          ts: expect.any(Number),
          st: 200,
        },
      ],
    })
    expect(Math.abs(body.e[0].ts - Date.now() / 1000)).toBeLessThan(5)
    // The secret travels in the header only.
    expect(init.body).not.toContain('proxy_secret')
  })

  it('posts to the endpoint given', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    await reportAiAgent({ ...report, fetch, endpoint: 'https://brand.com/_skoup/t/agents' })
    expect(fetch.mock.calls[0][0 as never]).toBe('https://brand.com/_skoup/t/agents')
  })

  it('swallows the errors: refused, unreachable, throwing, too slow', async () => {
    const refused = vi.fn(async () => new Response(null, { status: 401 }))
    expect(await reportAiAgent({ ...report, fetch: refused })).toBe(false)

    const down = vi.fn(async () => {
      throw new TypeError('fetch failed')
    })
    expect(await reportAiAgent({ ...report, fetch: down })).toBe(false)

    const throwing = vi.fn(() => {
      throw new Error('sync')
    }) as unknown as FetchLike
    expect(await reportAiAgent({ ...report, fetch: throwing })).toBe(false)

    vi.useFakeTimers()
    let signal: AbortSignal | undefined
    const slow = vi.fn((_url: string, init: RequestInit) => {
      signal = init.signal ?? undefined
      return new Promise<Response>(() => {})
    }) as unknown as FetchLike
    const pending = reportAiAgent({ ...report, fetch: slow, timeout: 500 })
    await vi.advanceTimersByTimeAsync(500)
    expect(await pending).toBe(false)
    expect(signal?.aborted).toBe(true)
  })

  it('sends nothing without a site, a secret or an IP', async () => {
    const fetch = vi.fn(async () => new Response(null, { status: 204 }))
    expect(await reportAiAgent({ ...report, fetch, site: '' })).toBe(false)
    expect(await reportAiAgent({ ...report, fetch, secret: '' })).toBe(false)
    expect(await reportAiAgent({ ...report, fetch, ip: null })).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })
})
