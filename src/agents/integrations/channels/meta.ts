import axios from "axios"
import { ulid } from "ulid"
import { supabase } from "../../db"
import { messenger } from "../messenger"
import { platforms } from "../messenger/config"
import { base64ToBytes, bytesToBase64 } from "./base64"
import { extensionOf, mimeOf } from "../mime"
import type { MessengerEvent, MessengerWebhookPayload } from "../messenger/types"

type MetaChannelType = keyof typeof platforms

// Messenger and Instagram DMs share the webhook shape and the Send API, so both channels are the
// same adapter with different platform limits: see platforms in ../messenger/config.
export function buildMetaAdapter(type: MetaChannelType): ChannelAdapter<MessengerWebhookPayload> {

  const platform = platforms[type]

  return {

    type,

    async parse(channel, payload) {

      const { page_id, page_token } = channel.settings || {}
      if (!page_id) return `No ${type} page id found.`
      if (!page_token) return `No ${type} page token found.`

      const event = firstMessage(payload)
      if (!event) return null

      const userId = event.sender?.id
      if (!userId) return "No sender id provided."

      const message = event.message

      let audio: { audio: string, ext: string }
      let content = ""
      const files: ChannelInput["files"] = []

      if (event.postback) content = event.postback.title || event.postback.payload || ""
      else if (message?.quick_reply?.payload) content = message.quick_reply.payload
      else content = message?.text || ""

      for (const attachment of message?.attachments || []) {
        const url = attachment.payload?.url
        if (!url) continue
        switch (attachment.type) {
          case "audio": {
            // Meta attachment urls are public CDN links, no token needed unlike the Whatsapp media endpoint.
            const fileContent = await axios.get(url, { responseType: "arraybuffer" })
            audio = { audio: bytesToBase64(new Uint8Array(fileContent.data)), ext: extensionOf(url) || "mp4" }
            break
          }
          case "image":
          case "video":
          case "file":
            files.push({ url, type: mimeOf(url), filename: attachment.payload?.title })
            break
          default:
            // location, fallback, stickers, story mentions and shared posts carry nothing the agent can consume
            console.log(`[${type}] Ignoring attachment type: ${attachment.type}`)
        }
      }

      content = content.trim()
      if (!content && !audio && files.length === 0) return "No media or content provided."

      const contactName = await messenger.getProfile(userId, page_token, platform.profileFields)

      const input: ChannelInput = { content, files, audio, from: userId, contactName, message_id: message?.mid || event.postback?.mid }
      const integration: IntegrationPayload = { type, external_id: `${type}:${userId}`, name: contactName }

      return { input, integration }

    },

    async typing(channel, input) {
      const { page_id, page_token } = channel.settings || {}
      await messenger.sendTypingIndicator({ page_id, page_token, to: input.from })
    },

    async send(channel, input, out) {

      const { page_id, page_token } = channel.settings || {}
      const files = [...out.files]

      if (out.audio) {
        // Meta only accepts attachments by url, so the generated audio is published first.
        const ext = out.audio.ext || "ogg"
        const f = await supabase.storage.from("temp").upload(`${ulid()}.${ext}`, base64ToBytes(out.audio.audio), { contentType: `audio/${ext}` })
        const { data } = supabase.storage.from("temp").getPublicUrl(f.data.path)
        files.push(data.publicUrl)
      }

      if (!out.response && files.length === 0 && out.quickReplies.length === 0) return

      await messenger.send({ page_id, page_token, to: input.from, message: out.response, files, quickReplies: out.quickReplies, platform })

    },

    async notify(channel, payload, error) {
      const userId = firstMessage(payload)?.sender?.id
      if (!userId) return
      const { page_id, page_token } = channel.settings || {}
      await messenger.send({ page_id, page_token, to: userId, message: error, platform })
    },

  }

}

// Meta batches events: take the first inbound message or postback and skip everything else.
// Echoes are the page's own outgoing messages, so processing them would make the agent answer itself.
function firstMessage(payload: MessengerWebhookPayload): MessengerEvent | null {
  for (const entry of payload?.entry || []) {
    for (const event of entry.messaging || []) {
      if (event.delivery || event.read || event.reaction) continue
      if (event.message?.is_echo || event.message?.is_deleted || event.message?.is_unsupported) continue
      if (event.message || event.postback) return event
    }
  }
  return null
}
