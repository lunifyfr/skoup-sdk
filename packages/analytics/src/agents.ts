/**
 * `@skoup/analytics/agents` — **server only**. The browser script never
 * sees the AI assistants that read a site (they run no JavaScript): the
 * site's server reports their requests to Skoup itself, with the site's
 * proxy secret (Réglages › Intégrations › Skoup Analytics), which must
 * never reach a browser. Not part of the tag nor of the browser entry.
 *
 * `isAiAgent()` pre-filters on the User-Agent (`AI_AGENTS`);
 * `reportAiAgent()` posts one request to `POST /t/agents`. The collector is
 * the judge: it checks the IP against the operator's published ranges,
 * then forgets it.
 */
import { AI_AGENTS } from './ai-agents'

export { AI_AGENTS, type AiAgent } from './ai-agents'

export const DEFAULT_AGENTS_ENDPOINT = 'https://api.skoup.ai/t/agents'
/** How long a report may take before it is given up (ms). */
export const AGENTS_TIMEOUT_MS = 2000
const MAX_USER_AGENT = 512

const TOKENS = AI_AGENTS.map((agent) => agent.token.toLowerCase())

/** True when the User-Agent names a known AI assistant or crawler (`AI_AGENTS`). */
export function isAiAgent(userAgent: string | null | undefined): boolean {
  if (typeof userAgent !== 'string' || !userAgent) return false
  const ua = userAgent.toLowerCase()
  return TOKENS.some((token) => ua.includes(token))
}

/** The `fetch` the report goes through — the global one, or yours. */
export type FetchLike = (url: string, init: RequestInit) => Promise<Response>

export interface AiAgentReport {
  /** The brand's site key (`site_…`). */
  site: string
  /** The site's proxy secret — server side only, sent as `X-Skoup-Proxy`. */
  secret: string
  /** The collector; `https://api.skoup.ai/t/agents` by default. */
  endpoint?: string
  /** The request's User-Agent (cut to 512 characters). */
  userAgent: string | null | undefined
  /** The IP of the client that made the request — checked by Skoup, then forgotten. */
  ip: string | null | undefined
  /** The URL requested, absolute (`https://host/path?query`; the fragment is dropped). */
  url: string
  /** The HTTP status answered, when known. */
  status?: number
  /** A `fetch` of your own (defaults to the global one). */
  fetch?: FetchLike
  /** Given up after this many ms (default 2000). */
  timeout?: number
}

/** One event of `POST /t/agents`. */
export interface AiAgentEvent {
  ua: string
  ip: string
  u: string
  ts: number
  st?: number
}

/**
 * The event `reportAiAgent` sends for this request, or null when it
 * cannot be sent (no User-Agent, no IP, a URL that is not http(s)).
 */
export function aiAgentEvent(
  report: Pick<AiAgentReport, 'userAgent' | 'ip' | 'url' | 'status'>,
  now: number = Date.now(),
): AiAgentEvent | null {
  const ua = typeof report.userAgent === 'string' ? report.userAgent.trim() : ''
  const ip = typeof report.ip === 'string' ? report.ip.trim() : ''
  if (!ua || !ip) return null
  let u: string
  try {
    const url = new URL(report.url)
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null
    u = url.origin + url.pathname + url.search
  } catch {
    return null
  }
  const event: AiAgentEvent = { ua: ua.slice(0, MAX_USER_AGENT), ip, u, ts: Math.floor(now / 1000) }
  const status = report.status
  if (typeof status === 'number' && Number.isInteger(status) && status >= 100 && status <= 599) {
    event.st = status
  }
  return event
}

/**
 * Reports one request of an AI agent to Skoup — call it for requests
 * `isAiAgent()` accepts. Resolves `true` when the collector took it
 * (2xx), `false` otherwise; never rejects nor throws, and gives up after
 * `timeout` ms: a report never breaks nor slows the site's response.
 */
export async function reportAiAgent(report: AiAgentReport): Promise<boolean> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    const site = (report.site || '').trim()
    const secret = (report.secret || '').trim()
    const send: FetchLike | undefined =
      report.fetch ?? (typeof fetch === 'function' ? (url, init) => fetch(url, init) : undefined)
    const event = aiAgentEvent(report)
    if (!site || !secret || !send || !event) return false

    const controller = typeof AbortController === 'function' ? new AbortController() : null
    const timeout = new Promise<false>((resolve) => {
      timer = setTimeout(() => {
        controller?.abort()
        resolve(false)
      }, report.timeout ?? AGENTS_TIMEOUT_MS)
    })
    const request = send(report.endpoint || DEFAULT_AGENTS_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'X-Skoup-Proxy': secret },
      body: JSON.stringify({ s: site, e: [event] }),
      signal: controller?.signal,
    }).then(
      (response) => response.ok,
      () => false,
    )
    return await Promise.race([request, timeout])
  } catch {
    return false
  } finally {
    if (timer !== undefined) clearTimeout(timer)
  }
}
