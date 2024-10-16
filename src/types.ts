import "./types.agents"
export { }

declare global {

  type LiteralUnion<KnownValues extends string> = (string & {}) | KnownValues

  interface SearchParams {
    provider?: "weaviate" | "exa"
    query: string
    domains?: string[]
    distance?: number
    limit?: number
  }

  interface ChatHistoryItem {
    role?: "user" | "assistant"
    content?: string
  }

  interface BotReponse {
    answer: string
  }

  interface Doc {
    id?: number
    title?: string
    body?: string
    source?: string
    lat?: number
    lon?: number
    fromLine?: number
    toLine?: number
    origin?: string
    domain?: string
    country?: string
  }

}