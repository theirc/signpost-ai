export { }

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

  /** Per-agent escalation flag definition, stored in agents.config.escalation_flags */
  interface AgentEscalationFlag {
    id: string
    type: "builtin" | "custom"
    label: string
    icon: string
    detection_prompt: string
    enabled: boolean
  }

  /** Per-message custom flag detection result, stored in messages.custom_message_flags */
  interface FlagDetectedItem {
    flagId: string
    status?: "flagged" | "resolved"
    reasoning?: string
    confidence?: number
    detectedAt?: string
  }

  /** The three builtin flag IDs */
  type BuiltinFlagId = "high_risk" | "low_confidence" | "asked_human"

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
    hitl?: boolean

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

    integration?: IntegrationPayload

    /** Built-in flags: 0 none, 1 flagged, 2 resolved; null = legacy */
    highrisk?: number | null
    lowconf?: number | null
    askhuman?: number | null

    /** Custom escalation flags only */
    custom_message_flags?: FlagDetectedItem[]

    rating?: "0" | "1"
    rating_example?: string

  }

  interface Evaluation_Category {
    id?: number
    name?: string
    description?: string
    // applies_to?: "user_message" | "agent_response" | "conversation" | "all"
    created_at?: string
    team?: string
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
    /** When true, detections for this item count as the “high risk” moderation flag */
    highrisk?: boolean | null
    /** When true, detections count as “low confidence” */
    lowconf?: boolean | null
    /** When true, detections count as “ask human” */
    askhuman?: boolean | null
  }

  interface Form {
    id?: string
    title: string
    fields?: FormFieldDef[]
    team?: string
    created_at?: string
  }

  type FormCondingOperator =
    | "equals" | "notEquals" | "contains" | "notContains"
    | "gt" | "lt" | "gte" | "lte" | "isEmpty" | "isNotEmpty"

  interface FormFieldCondition {
    field: string
    operator: FormCondingOperator
    value?: string | number | boolean
  }

  interface FormFieldDef {
    title: string
    name: string,
    required?: boolean
    type: "string" | "number" | "boolean" | "date" | "list" | "multiselect" | "group"
    list?: { label: string, value: string }[]
    subfields?: FormFieldDef[]

    extraction?: {
      enabled: boolean
      method?: "ai" | "keyword"
      instruction: string
      minConfidence?: number
      // Once a human has edited the field, never let the agent overwrite it.
      lockAfterHuman?: boolean
      keywords?: string[]
      keywordMatch?: "any" | "all" | "phrase"
      keywordValue?: string
    }

    visibleWhen?: FormFieldCondition[]

    calculated?: {
      formula: string
    }
  }


  // Per provider credentials for channels added after the whatsapp_* / telerivet_* columns.
  interface ChannelSettings {
    //Messenger and Instagram, both answered through the linked Facebook Page
    page_id?: string
    page_token?: string

    //Telegram
    bot_token?: string
  }

  interface Channel {
    id?: string
    title?: string
    type?: "app" | "telerivet" | "whatsapp" | "messenger" | "instagram" | "telegram"
    agent?: number

    debounce_time?: number //in seconds
    debounce_type?: "none" | "singleAgentInstance" | "debounce"

    debug?: boolean
    evaluations?: number[]
    team?: string

    telerivet_apikey?: string
    telerivet_projectid?: string
    telerivet_routeid?: string

    whatsapp_phoneid?: string
    whatsapp_token?: string

    answer_via_whatsapp?: boolean

    settings?: ChannelSettings

    created_at?: string

  }



}