import { extensionOf } from "../mime"
import { sendMediaMessage } from "./sendMediaMessage"
import { sendTextMessage } from "./sendTextMessage"
import type { TelegramMediaType } from "./types"

interface SendParams {
  token: string
  to: string
  message: string

  files?: string[]
  quickReplies?: string[]
}

const mediaTypes: { [ext: string]: TelegramMediaType } = {
  jpg: "photo", jpeg: "photo", png: "photo", gif: "photo", webp: "photo",
  ogg: "voice", oga: "voice",
  mp3: "audio", wav: "audio", m4a: "audio", aac: "audio",
  mp4: "video", mov: "video", "3gp": "video", webm: "video",
}

export function mediaType(url: string): TelegramMediaType {
  return mediaTypes[extensionOf(url)] || "document"
}

export async function send({ token, to, message, files = [], quickReplies = [] }: SendParams) {

  message = (message || "").trim()

  const media = files.map(link => ({ link, type: mediaType(link) }))

  // Telegram supports captions, so a lone photo with its text travels as a single message like on Whatsapp.
  let caption: string
  if (media.length === 1 && media[0].type === "photo" && message && quickReplies.length === 0) {
    caption = message
    message = ""
  }

  for (const m of media) {
    await sendMediaMessage({ token, to, link: m.link, type: m.type, caption: m.type === "photo" ? caption : undefined })
  }

  if (message || quickReplies.length > 0) await sendTextMessage({ token, to, body: message, quickReplies })

}
