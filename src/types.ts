export { }


declare global {

  type Providers = "openai" | "gemini" | "claude" | "ollama"
  type Roles = "user" | "assistant"


  interface BotConfig {

    kbtype: "weaviate" | "vectorless"

    temperature?: number
    prompt?: string

    llm?: Providers
    model?: string

    searchDistance?: number
    searchMaxresults?: number
    searchDomains?: string[]

  }


  interface ChatHistoryItem {
    role?: Roles
    content?: string
  }


  interface BotRequest {
    id?: number
    message?: string
    history?: ChatHistoryItem[]
    config: BotConfig
    zendeskid?: number
    background?: boolean
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
    metadata?: Doc //compatibility
  }

  interface Answer {
    message?: string
    docs?: Doc[]
    error?: string
  }


  interface Channel {
    link?: string
    title?: string
    disable?: boolean
  }

}