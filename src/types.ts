export { }


declare global {

  interface BotHistory {
    isHuman: boolean
    message: string
  }

  interface ChatHistoryItem {
    role?: "user" | "assistant",
    content?: string
  }


  interface BotRequest {
    id?: number
    message?: string
    history?: BotHistory[]
    chunked?: boolean
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
    chunked?: string[]
    docs?: Doc[]
    error?: string
    needsRebuild?: boolean
    isAnswer?: boolean
    isContacts?: boolean
  }

  interface AILog {
    id?: number
    final_prompt?: string
    date_created?: string
    router_isContact?: boolean
    router_searchTerms?: string
    router_location?: string
    router_language?: string
    user_message?: string
    bot?: number
    search_results?: string
    answer?: string
    answer_constitutional?: string
    error?: string
    perfinit?: number | bigint
    perfrouting?: number | bigint
    perfsearch?: number | bigint
    perfllmcall?: number | bigint
    perfconstitutional?: number | bigint
  }

  interface Channel {
    link?: string
    title?: string
    disable?: boolean
  }

}