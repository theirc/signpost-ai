export type TelegramMediaType = "photo" | "document" | "video" | "audio" | "voice"

export interface TelegramUpdate {
  update_id?: number
  message?: TelegramMessage
  // Updates we acknowledge and ignore
  edited_message?: TelegramMessage
  channel_post?: TelegramMessage
  callback_query?: unknown
  my_chat_member?: unknown
}

export interface TelegramMessage {
  message_id?: number
  from?: TelegramUser
  chat?: TelegramChat
  date?: number
  text?: string
  caption?: string
  photo?: TelegramFileRef[] // ascending sizes, the last one is the largest
  document?: TelegramFileRef
  voice?: TelegramFileRef
  audio?: TelegramFileRef
  video?: TelegramFileRef
  video_note?: TelegramFileRef
  sticker?: unknown
  location?: unknown
  contact?: unknown
}

export interface TelegramUser {
  id?: number
  is_bot?: boolean
  first_name?: string
  last_name?: string
  username?: string
  language_code?: string
}

export interface TelegramChat {
  id?: number
  type?: string // private | group | supergroup | channel
}

export interface TelegramFileRef {
  file_id?: string
  file_unique_id?: string
  file_name?: string
  mime_type?: string
  file_size?: number
}

export interface TelegramFile {
  file_id?: string
  file_path?: string
  file_size?: number
}
