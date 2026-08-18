import { MAX_CAPTION_LENGTH } from "./config"
import { post } from "./request"
import type { TelegramMediaType } from "./types"

export interface SendMediaMessageParams {
  token: string
  to: string
  link: string
  type: TelegramMediaType
  caption?: string
}

const methods: { [type in TelegramMediaType]: string } = {
  photo: "sendPhoto",
  document: "sendDocument",
  video: "sendVideo",
  audio: "sendAudio",
  voice: "sendVoice",
}

export async function sendMediaMessage({ token, to, link, type, caption }: SendMediaMessageParams) {
  const payload: any = { chat_id: to, [type]: link }
  if (caption) payload.caption = caption.substring(0, MAX_CAPTION_LENGTH)
  await post(token, methods[type], payload)
}
