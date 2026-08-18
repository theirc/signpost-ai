import { ulid } from "ulid"
import { supabase } from "../../db"
import { telegram } from "../telegram"
import { mimeTypes } from "../mime"
import { base64ToBytes, bytesToBase64 } from "./base64"
import type { TelegramFileRef, TelegramMessage, TelegramUpdate } from "../telegram/types"

export const telegramChannel: ChannelAdapter<TelegramUpdate> = {

  type: "telegram",

  async parse(channel, update) {

    const token = channel.settings?.bot_token
    if (!token) return "No telegram bot token found."

    // Edited messages, channel posts, callback queries and membership changes are not conversation turns.
    const message = update?.message
    if (!message) return null
    if (message.from?.is_bot) return null
    // A bot added to a group receives every message: only one to one chats are answered.
    if (message.chat?.type !== "private") return null

    const chatId = message.chat?.id
    const userId = message.from?.id
    if (!chatId || !userId) return "No chat id provided."

    let audio: { audio: string, ext: string }
    const files: ChannelInput["files"] = []
    const content = (message.text || message.caption || "").trim()

    const voice = message.voice || message.audio
    if (voice?.file_id) {
      const f = await telegram.downloadFile(token, voice.file_id)
      if (f) audio = { audio: bytesToBase64(f.bytes), ext: f.ext || "ogg" }
    } else {
      const attachment = largestPhoto(message) || message.document || message.video || message.video_note
      if (attachment?.file_id) {
        const published = await publish(token, attachment)
        if (published) files.push(published)
      }
    }

    if (!content && !audio && files.length === 0) return "No media or content provided."

    const contactName = [message.from?.first_name, message.from?.last_name].filter(Boolean).join(" ") || message.from?.username || ""

    const input: ChannelInput = { content, files, audio, from: String(chatId), contactName, message_id: String(message.message_id ?? "") }
    const integration: IntegrationPayload = { type: "telegram", external_id: `telegram:${userId}`, name: contactName }

    return { input, integration }

  },

  async typing(channel, input) {
    await telegram.sendChatAction({ token: channel.settings?.bot_token, to: input.from })
  },

  async send(channel, input, out) {

    const token = channel.settings?.bot_token
    const files = [...out.files]

    if (out.audio) {
      // Telegram sends media by url, so the generated audio is published first. Ogg becomes a native voice note.
      const ext = out.audio.ext || "ogg"
      const url = await upload(`${ulid()}.${ext}`, base64ToBytes(out.audio.audio), mimeTypes[ext] || "audio/ogg")
      if (url) files.push(url)
    }

    if (!out.response && files.length === 0 && out.quickReplies.length === 0) return

    await telegram.send({ token, to: input.from, message: out.response, files, quickReplies: out.quickReplies })

  },

  async notify(channel, update, error) {
    const chatId = update?.message?.chat?.id
    if (!chatId) return
    await telegram.send({ token: channel.settings?.bot_token, to: String(chatId), message: error })
  },

}

function largestPhoto(message: TelegramMessage): TelegramFileRef | undefined {
  const photo = message.photo
  return photo?.length ? photo[photo.length - 1] : undefined
}

// Telegram file urls carry the bot token, so incoming files are republished to the temp bucket
// and the agent only ever sees a plain public url.
async function publish(token: string, attachment: TelegramFileRef): Promise<ChannelInput["files"][number] | null> {

  const f = await telegram.downloadFile(token, attachment.file_id)
  if (!f) return null

  const ext = f.ext || "bin"
  const type = attachment.mime_type || mimeTypes[ext] || "application/octet-stream"
  const url = await upload(`${ulid()}.${ext}`, f.bytes, type)
  if (!url) return null

  return { url, type, filename: attachment.file_name }

}

async function upload(path: string, bytes: Uint8Array, contentType: string): Promise<string | null> {
  const f = await supabase.storage.from("temp").upload(path, bytes, { contentType })
  if (f.error || !f.data?.path) {
    console.error("[telegram] Error uploading file to temp", f.error)
    return null
  }
  return supabase.storage.from("temp").getPublicUrl(f.data.path).data.publicUrl
}
