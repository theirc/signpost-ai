export interface MessengerCredentials {
  page_id: string
  page_token: string
}

export type MessengerAttachmentType = "image" | "audio" | "video" | "file"

export interface MetaPlatform {
  maxTextLength: number
  profileFields: string
  supportsFiles: boolean
}

export interface MessengerWebhookPayload {
  object?: string // "page" for Messenger, "instagram" for Instagram DMs
  entry?: MessengerEntry[]
}

export interface MessengerEntry {
  id?: string // page id
  time?: number
  messaging?: MessengerEvent[]
}

export interface MessengerEvent {
  sender?: { id: string }    // PSID
  recipient?: { id: string } // page id
  timestamp?: number
  message?: MessengerMessage
  postback?: MessengerPostback
  // Events we acknowledge and ignore
  delivery?: unknown
  read?: unknown
  reaction?: unknown
}

export interface MessengerMessage {
  mid?: string
  text?: string
  is_echo?: boolean // messages sent by the page itself
  is_deleted?: boolean
  is_unsupported?: boolean
  quick_reply?: { payload?: string }
  attachments?: MessengerAttachment[]
}

export interface MessengerPostback {
  mid?: string
  title?: string
  payload?: string
}

export interface MessengerAttachment {
  type?: string // image | audio | video | file | location | fallback
  payload?: {
    url?: string
    title?: string
    sticker_id?: number
    coordinates?: { lat: number, long: number }
  }
}
