/**
 * `@skoup/analytics-next/proxy` — for the `proxy.ts` (Next 16) or
 * `middleware.ts` (Next 14–15) of the site: reports to Skoup the requests
 * of the AI assistants and crawlers, which the browser script never sees.
 * Server only (it carries the site's proxy secret); not a client module.
 */
import { isAiAgent, reportAiAgent, type FetchLike } from '@skoup/analytics/agents'

export interface ReportAiAgentsOptions {
  /** The brand's site key (`site_…`). */
  site: string | undefined
  /** The site's proxy secret (an environment variable, never `NEXT_PUBLIC_`). */
  secret: string | undefined
  /** The collector; `https://api.skoup.ai/t/agents` by default. */
  endpoint?: string
  /** A `fetch` of your own (defaults to the global one). */
  fetch?: FetchLike
  /** Given up after this many ms (default 2000). */
  timeout?: number
  /**
   * The HTTP status the proxy answers, when it decides the response itself
   * (a redirect, a 410 for a page you removed). Omitted, Skoup checks the
   * page's status on its own once a day: a proxy runs before the page
   * renders and cannot know a 404 of the app.
   */
  status?: number
}

/** What the helper reads of the request — a `NextRequest` or any `Request`. */
export interface RequestLike {
  url: string
  headers: { get(name: string): string | null }
}

/** What the helper needs of the event — Next's `NextFetchEvent`. */
export interface FetchEventLike {
  waitUntil(promise: Promise<unknown>): void
}

/** The client's IP: the first `x-forwarded-for` hop, else `x-real-ip`. */
export function clientIp(headers: RequestLike['headers']): string | null {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim()
  return forwarded || headers.get('x-real-ip')?.trim() || null
}

/**
 * Reports the request to Skoup when its User-Agent is an AI agent
 * (`isAiAgent`), in `event.waitUntil()`: the response is not held for it,
 * and nothing it does can throw. Does nothing for any other request, or
 * without `site` / `secret` (a preview without the environment variables).
 * Returns true when a report was started.
 *
 * ```ts
 * // proxy.ts
 * export function proxy(request: NextRequest, event: NextFetchEvent) {
 *   reportAiAgents(request, event, { site: process.env.SKOUP_SITE, secret: process.env.SKOUP_PROXY_SECRET })
 *   return NextResponse.next()
 * }
 * ```
 */
export function reportAiAgents(
  request: RequestLike,
  event: FetchEventLike,
  options: ReportAiAgentsOptions,
): boolean {
  try {
    if (!options.site || !options.secret) return false
    const userAgent = request.headers.get('user-agent')
    if (!isAiAgent(userAgent)) return false
    event.waitUntil(
      reportAiAgent({
        site: options.site,
        secret: options.secret,
        endpoint: options.endpoint,
        fetch: options.fetch,
        timeout: options.timeout,
        userAgent,
        ip: clientIp(request.headers),
        url: request.url,
        status: options.status,
      }),
    )
    return true
  } catch {
    return false
  }
}

export { isAiAgent, AI_AGENTS } from '@skoup/analytics/agents'
