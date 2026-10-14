/**
 * The User-Agent tokens of the AI assistants and crawlers that read a
 * site — a pre-filter only: the Skoup collector keeps its own registry
 * and checks the IP against each operator's published ranges, so a
 * request that merely claims one of these is not counted.
 *
 * `kind`: `user` = fetched for a person asking the assistant now, `search`
 * = the assistant's search index, `training` = a crawler collecting
 * training data. Matched as a case-insensitive substring of the
 * User-Agent.
 */
export interface AiAgent {
  token: string
  operator: string
  kind: 'user' | 'search' | 'training'
}

export const AI_AGENTS: readonly AiAgent[] = [
  { token: 'ChatGPT-User', operator: 'OpenAI', kind: 'user' },
  { token: 'OAI-SearchBot', operator: 'OpenAI', kind: 'search' },
  { token: 'GPTBot', operator: 'OpenAI', kind: 'training' },
  { token: 'Perplexity-User', operator: 'Perplexity', kind: 'user' },
  { token: 'PerplexityBot', operator: 'Perplexity', kind: 'search' },
  { token: 'Claude-User', operator: 'Anthropic', kind: 'user' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', kind: 'search' },
  { token: 'ClaudeBot', operator: 'Anthropic', kind: 'training' },
  { token: 'MistralAI-User', operator: 'Mistral AI', kind: 'user' },
  { token: 'DuckAssistBot', operator: 'DuckDuckGo', kind: 'user' },
  { token: 'meta-externalfetcher', operator: 'Meta', kind: 'user' },
  { token: 'meta-externalagent', operator: 'Meta', kind: 'training' },
  { token: 'Amazonbot', operator: 'Amazon', kind: 'search' },
  { token: 'Applebot', operator: 'Apple', kind: 'search' },
  { token: 'Bytespider', operator: 'ByteDance', kind: 'training' },
  { token: 'CCBot', operator: 'Common Crawl', kind: 'training' },
]
