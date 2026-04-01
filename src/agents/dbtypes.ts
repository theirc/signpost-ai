
interface MessageEvaluationItem {
  itemId?: number
  severity?: number
  confidence?: number
  reasoning?: string
  status?: "flagged" | "resolved"
}

interface MessageComment {
  id: string
  message_id?: string
  text: string
  author_id: string
  author_name: string
  created_at: number
}


declare global {

  type MessageRoles = 'user' | 'assistant' | "human" | "synthetic"
  type ContactTypes = "user" | "operator" | "synthetic" | "ai"

  interface EvaluationContactPayload {
    count?: number
    lastSeverity?: number
    firstSeen?: string
    lastSeen?: string
  }

  interface Contact {
    id?: string
    name?: string
    avatar?: string
    type?: ContactTypes
    data?: string
    team?: string
    code?: string
    created_at?: string

    summary?: string
    severity?: number
    lasteval?: string
    no_reply_needed?: boolean
    internal_comments?: MessageComment[]

    evaluation?: {
      [index: string]: EvaluationContactPayload
    }

    // ------ Local Usage -------------

    /**
      * Local Usage Only, not for Database
    */
    lastMessage?: string

    /**
      * Local Usage Only, not for Database
    */
    lastMessageTime?: string

    /**
      * Local Usage Only, not for Database
    */
    unreadCount?: number
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

    agent_appropriate?: boolean
    agent_concern_level?: number
    agent_reasoning?: string

    escalation_detected?: boolean
    escalation_from_level?: number
    escalation_to_level?: number
    escalation_reasoning?: string

    narrative_update?: string

    agent_detected_items?: MessageEvaluationItem[]
    user_detected_items?: MessageEvaluationItem[]

    rating?: "0" | "1"
    rating_example?: string

  }

  interface Evaluation_Category {
    id?: number
    name?: string
    description?: string
    // applies_to?: "user_message" | "agent_response" | "conversation" | "all"
    created_at?: string
  }

  interface Evaluation_Item {
    id?: string | number
    name?: string
    description?: string
    category?: number
    key_signals?: string
    weight?: number
    type?: "user_message" | "agent_response"
    created_at?: string
    askhuman?: boolean
    highrisk?: boolean
    lowconf?: boolean
  }



}