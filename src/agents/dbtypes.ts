
declare global {

  type MessageRoles = 'user' | 'assistant' | "human" | "synthetic"
  type ContactTypes = "user" | "operator" | "synthetic" | "ai"

  interface Contact {
    id?: string
    name?: string
    avatar?: string
    type?: ContactTypes
    data?: string
    team?: string
    code?: string
    created_at?: string
  }

  interface Message {
    id?: string
    contact?: string
    message?: string
    agent?: number
    channel?: IntegrationsTypes
    role?: MessageRoles
    team?: string
    sender?: string
    created_at?: string
  }

}