import axios from "axios"
import { agents } from "../../agent"
import { whatsapp } from "../whatsapp"
import { baseUrl } from "../whatsapp/config"
import { bytesToBase64 } from "./base64"
import { splitBreaks } from "./breaks"
import { cache, loadApiKeys } from "./cache"
import { matchCommand, processCommand } from "./commands"
import { coordinate } from "./debounce"
import { saveAndEvaluate } from "./conversation"
import type { WhatsAppWebhookPayload } from "../whatsapp/hook"

export async function processWhatsapp(channel: Channel, payload: WhatsAppWebhookPayload) {

  let error: string

  try {
    error = await handle(channel, payload)
  } catch (err) {
    error = `Whatsapp Hook Error: ${err || "Unknown error"}`
  }

  if (error) console.error(`Whatsapp: ${error}`)

  if (channel.debug && error) {
    try {
      await tryToNotify(error, channel, payload)
    } catch (err) {
      console.error(`Error sending Whatsapp Notification error ${err}`)
    }
  }

}

async function handle(channel: Channel, payload: WhatsAppWebhookPayload): Promise<string> {

  if (!channel.agent) return "No agent in channel."
  if (!channel.team) return "No team in channel."

  const value = payload?.entry?.[0]?.changes?.[0]?.value
  const message = value?.messages?.[0]
  if (!message) return "No message provided."

  const from = message.from
  if (!from) return "No from number provided."

  const apiKeys = await loadApiKeys(channel.team)
  if (!apiKeys) return "No api keys found."

  const whatsapp_token = channel.whatsapp_token

  let audio: { audio: string, ext: string }
  let content = ""
  const files: ChannelInput["files"] = []

  switch (message.type) {
    case "text":
      content = message.text?.body || ""
      break
    case "interactive":
      content = message.interactive?.button_reply?.title || message.interactive?.list_reply?.title || ""
      break
    case "button":
      content = message.button?.text || ""
      break
    case "image":
    case "document":
    case "audio": {
      const media = message[message.type] as WhatsAppMediaMessage
      const url = await getMediaUrl(media.id, whatsapp_token)
      if (url) {
        if (message.type === "audio") {
          const fileContent = await axios.get(url, { responseType: "arraybuffer", headers: { Authorization: "Bearer " + whatsapp_token } })
          audio = { audio: bytesToBase64(new Uint8Array(fileContent.data)), ext: "ogg" }
        } else {
          content = media.caption || ""
          files.push({ url, type: media.mime_type, filename: media.filename })
        }
      }
      break
    }
    default:
      return `Unsupported message type: ${message.type}`
  }

  const contactName = value?.contacts?.[0]?.profile?.name || ""
  content = content.trim()

  const command = matchCommand(content)

  if (!command) await whatsapp.sendTypingIndicator({ message_id: message.id, phone: channel.whatsapp_phoneid, token: whatsapp_token })

  const input: ChannelInput = { content, files, audio, from, contactName, message_id: message.id }

  const cached = await cache.getContact({ phone: from, name: contactName, type: "whatsapp" }, channel.team, apiKeys.codec)
  if (!cached) return "Could not resolve contact."

  // Commands are handled here: no agent, no persistence, no evaluation.
  if (command) {
    const response = await processCommand(content, cached.contact.id)
    try {
      if (response) await whatsapp.send({ token: whatsapp_token, phone: channel.whatsapp_phoneid, to: from, message: response, message_id: message.id })
    } catch (err) {
      return `Error sending command response: ${err}`
    }
    return ""
  }

  const run = (i: ChannelInput) => runWhatsapp(channel, cached, i, apiKeys)
  await coordinate(cached, channel.debounce_type, channel.debounce_time, input, run)

  return ""

}

async function runWhatsapp(channel: Channel, cached: CachedContact, input: ChannelInput, apiKeys: APIKeys) {

  const a = await agents.loadAgent(channel.agent, channel.team)
  if (!a) return

  const p: AgentParameters = {
    input: { message: input.content, files: input.files },
    uid: cached.contact.id,
    apiKeys,
  }
  if (input.audio) p.input.audio = input.audio

  await a.execute(p)
  if (p.error) { console.error(`Whatsapp Agent Error: ${p.error}`); return }

  const response = p.output?.response
  const media_urls: string[] = p.output?.files || []
  const quickReplies: string[] = p.output?.quickreplies || []

  for (const chunk of splitBreaks({ response, files: media_urls, quickReplies })) {
    await whatsapp.send({
      token: channel.whatsapp_token,
      phone: channel.whatsapp_phoneid,
      to: input.from,
      message: chunk.response,
      files: chunk.files,
      quickReplies: chunk.quickReplies,
      message_id: input.message_id,
    })
  }

  // Persist + evaluate AFTER answering, fire-and-forget so the agent is free to keep going (single-instance lock already released).
  saveAndEvaluate({ agent: a, contact: cached.contact, message: input.content, response, apiKeys, integration: { type: "whatsapp", message_id: input.message_id }, type: "whatsapp", team: channel.team }).catch(err => console.error("[channels] saveAndEvaluate error", err))

}

async function getMediaUrl(mediaId: string, token: string): Promise<string> {
  try {
    const r = await axios.get(`${baseUrl}/${mediaId}`, { headers: { Authorization: "Bearer " + token } })
    return r.data?.url
  } catch (err) {
    console.error(`Error getting media url: ${err}`)
    return null
  }
}

async function tryToNotify(error: string, channel: Channel, payload: WhatsAppWebhookPayload) {

  const value = payload?.entry?.[0]?.changes?.[0]?.value
  const message = value?.messages?.[0]
  const from = message?.from
  if (!from) return

  await whatsapp.send({
    token: channel.whatsapp_token,
    phone: channel.whatsapp_phoneid,
    to: from,
    message: error,
    message_id: message.id,
  })

}
