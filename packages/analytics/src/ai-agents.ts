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
  // Read to answer a person's question, at that moment.
  { token: 'ChatGPT-User', operator: 'OpenAI', kind: 'user' },
  { token: 'Perplexity-User', operator: 'Perplexity', kind: 'user' },
  { token: 'Claude-User', operator: 'Anthropic', kind: 'user' },
  { token: 'MistralAI-User', operator: 'Mistral AI', kind: 'user' },
  { token: 'Google-Agent', operator: 'Google', kind: 'user' },
  { token: 'Google-GeminiNotebook', operator: 'Google', kind: 'user' },
  { token: 'Google-NotebookLM', operator: 'Google', kind: 'user' },
  { token: 'DuckAssistBot', operator: 'DuckDuckGo', kind: 'user' },
  { token: 'meta-externalfetcher', operator: 'Meta', kind: 'user' },
  { token: 'Amzn-User', operator: 'Amazon', kind: 'user' },
  // The assistant's search index.
  { token: 'OAI-SearchBot', operator: 'OpenAI', kind: 'search' },
  { token: 'PerplexityBot', operator: 'Perplexity', kind: 'search' },
  { token: 'Claude-SearchBot', operator: 'Anthropic', kind: 'search' },
  { token: 'MistralAI-Index', operator: 'Mistral AI', kind: 'search' },
  { token: 'Applebot', operator: 'Apple', kind: 'search' },
  { token: 'meta-webindexer', operator: 'Meta', kind: 'search' },
  { token: 'Amzn-SearchBot', operator: 'Amazon', kind: 'search' },
  { token: 'YouBot', operator: 'You.com', kind: 'search' },
  // Training crawlers.
  { token: 'GPTBot', operator: 'OpenAI', kind: 'training' },
  { token: 'ClaudeBot', operator: 'Anthropic', kind: 'training' },
  { token: 'MistralAI-Training', operator: 'Mistral AI', kind: 'training' },
  { token: 'meta-externalagent', operator: 'Meta', kind: 'training' },
  { token: 'Amazonbot', operator: 'Amazon', kind: 'training' },
  { token: 'CCBot', operator: 'Common Crawl', kind: 'training' },
  { token: 'Bytespider', operator: 'ByteDance', kind: 'training' },
  { token: 'AI2Bot', operator: 'AI2', kind: 'training' },
]
