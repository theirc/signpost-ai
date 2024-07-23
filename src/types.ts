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

}