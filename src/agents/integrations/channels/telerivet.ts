import axios from "axios"
import { ulid } from "ulid"
import { agents } from "../../agent"
import { supabase } from "../../db"
import { whatsapp } from "../whatsapp"
import { base64ToBytes, bytesToBase64 } from "./base64"
import { cache, loadApiKeys } from "./cache"
import { coordinate } from "./debounce"
import { saveAndEvaluate } from "./conversation"

const MAX_QUICK_REPLY_LENGTH = 20
const MAX_QUICK_REPLIES_PER_MESSAGE = 3

export async function processTelerivet(channel: Channel, payload: TelerivetHookRequest) {

  let error: string

  try {
    error = await handle(channel, payload)
  } catch (err) {
    error = `Telerivet Hook Error: ${err || "Unknown error"}`
  }

  if (error) console.error(`Telerivet: ${error}`)

  if (channel.debug && error) {
    try {
      await sendMessage({ content: error, to_number: payload.from_number, projectId: payload.project_id, api_key: channel.telerivet_apikey })
    } catch (err) {
      console.error("Error sending error")
    }
  }

}

async function handle(channel: Channel, r: TelerivetHookRequest): Promise<string> {

  if (!channel.agent) return "No agent in channel."
  if (!channel.team) return "No team in channel."
  if (!r.media && !r.content) return "No media or content provided."
  if (!r.from_number) return "No from number provided."
  if (!channel.telerivet_apikey) return "No telerivet api key found."

  const apiKeys = await loadApiKeys(channel.team)
  if (!apiKeys) return "No api keys found."

  let audio: { audio: string, ext: string }
  const files: ChannelInput["files"] = []

  if (r.media && r.media.length > 0) {
    const media = r.media[0]
    if (media.type == "audio/ogg") {
      const fileContent = await axios.get(media.url, { responseType: "arraybuffer" })
      audio = { audio: bytesToBase64(new Uint8Array(fileContent.data)), ext: "ogg" }
    }
    for (let i = 1; i < r.media.length; i++) {
      const m = r.media[i]
      if (m.type != "audio/ogg") files.push(m)
    }
  }

  const from = r.from_number
  const content = (r.content || "").trim()
  const message_id = r.external_id

  await whatsapp.sendTypingIndicator({ message_id, phone: channel.whatsapp_phoneid, token: channel.whatsapp_token })

  const input: ChannelInput = { content, files, audio, from, contactName: r.contact?.name, message_id }

  const integration: IntegrationPayload = {
    phone: from,
    name: r.contact?.name,
    route_id: channel.telerivet_routeid,
    contact_id: r.contact_id,
    projectId: r.project_id,
    type: "telerivet",
  }

  const cached = await cache.getContact(integration, channel.team, apiKeys.codec)
  if (!cached) return "Could not resolve contact."

  const run = (i: ChannelInput) => runTelerivet(channel, cached, i, apiKeys, r.project_id)
  await coordinate(cached, channel.debounce_type, channel.debounce_time, input, run)

  return ""

}

async function runTelerivet(channel: Channel, cached: CachedContact, input: ChannelInput, apiKeys: APIKeys, projectId: string) {

  const a = await agents.loadAgent(channel.agent, channel.team)
  if (!a) return

  const p: AgentParameters = {
    input: { message: input.content, files: input.files },
    uid: cached.contact.id,
    apiKeys,
  }
  if (input.audio) p.input.audio = input.audio

  await a.execute(p)
  if (p.error) { console.error(`Telerivet Agent Error: ${p.error}`); return }

  const rawResponse = p.output?.response
  let response = rawResponse
  const { audio } = p.output || {}
  const media_urls: string[] = p.output?.files || []
  const quickReplies: string[] = p.output?.quickreplies || []

  const to_number = input.from
  const api_key = channel.telerivet_apikey
  const route_id = channel.telerivet_routeid ?? null

  if (audio) {
    const f = await supabase.storage.from("temp").upload(`${ulid()}.ogg`, base64ToBytes(audio.audio), { contentType: "audio/ogg" })
    const { data } = supabase.storage.from("temp").getPublicUrl(f.data.path)
    media_urls.push(data.publicUrl)
  }

  if (!response && media_urls.length == 0 && quickReplies.length == 0) {
    // No output to send
  } else if (channel.answer_via_whatsapp) {
    await whatsapp.send({
      token: channel.whatsapp_token,
      phone: channel.whatsapp_phoneid,
      to: to_number,
      message: response,
      files: media_urls,
      quickReplies,
      message_id: input.message_id,
    })
  } else {

    // Extract all image URLs from response (both markdown and plain URLs)
    if (response && media_urls.length == 0) {
      const allowedExt = /\.(jpg|jpeg|png|pdf|doc|docx|ogg|mp4)(\?[^\)\s]*)?$/i

      // First, extract markdown file URLs: ![alt](url) or [text](url)
      const markdownFileRegex = /!?\[.*?\]\((https?:\/\/[^\)\s]+)\)/gi
      let match
      while ((match = markdownFileRegex.exec(response)) !== null) {
        if (allowedExt.test(match[1])) media_urls.push(match[1])
      }
      // Remove only markdown links/images that are supported file types from response
      response = response.replace(/!?\[.*?\]\((https?:\/\/[^\)\s]+)\)/gi, (full, url) => allowedExt.test(url) ? '' : full).trim()

      // Then, extract plain URLs (not in markdown format)
      const plainFileRegex = /(?<!\]\()https?:\/\/[^\s<>]+/gi
      while ((match = plainFileRegex.exec(response)) !== null) {
        if (allowedExt.test(match[0])) media_urls.push(match[0])
      }
      // Remove only plain URLs that are supported file types from response
      response = response.replace(/(?<!\]\()https?:\/\/[^\s<>]+/gi, (url) => allowedExt.test(url) ? '' : url).trim()
    }

    if (response && quickReplies.length == 0) {
      const bracketedRegex = /\[([^\]]+)\]/g
      let match
      while ((match = bracketedRegex.exec(response)) !== null) {
        quickReplies.push(match[1])
      }
      // Remove all [bracketed] text from response
      response = response.replace(/\[[^\]]+\]/g, '').trim()
    }

    if (media_urls.length > 0) {
      console.log(`[Telerivet] Found ${media_urls.length} image(s)`)
      for (const url of media_urls) {
        await sendMessage({ to_number, projectId, api_key, media_url: url, route_id })
      }
    }

    response = response || ""

    if (response.includes("<break>")) {
      const parts = response.split("<break>").map((p: string) => p.trim()).filter(p => p.length > 0)
      for (let i = 0; i < parts.length - 1; i++) {
        await sendMessage({ content: parts[i], to_number, projectId, api_key, route_id })
      }
      if (parts.length > 0) await sendMessage({ content: parts[parts.length - 1], to_number, projectId, api_key, quickReplies, route_id })
    } else {
      await sendMessage({ content: response, to_number, projectId, api_key, quickReplies, route_id })
    }

  }

  // Persist + evaluate AFTER answering, fire-and-forget so the agent is free to keep going (single-instance lock already released).
  saveAndEvaluate({ agent: a, contact: cached.contact, message: input.content, response: rawResponse, apiKeys, integration: { type: "telerivet", message_id: input.message_id, route_id }, type: "telerivet", team: channel.team })
    .catch(err => console.error("[channels] saveAndEvaluate error", err))

}

interface SendMessageParameters {
  content?: string
  to_number?: string
  projectId?: string
  api_key?: string
  quickReplies?: string[]
  media_url?: string
  route_id?: string
}

async function sendMessage(p: SendMessageParameters) {

  const { content, to_number, projectId, api_key, quickReplies, media_url, route_id } = p

  if (!content && !media_url) return

  const telerivetUrl = `https://api.telerivet.com/v1/projects/${projectId}/messages/send`

  const payload: any = {
    content,
    to_number,
    message_type: "text",
    api_key,
  }

  if (media_url) payload.media_urls = [media_url]
  if (route_id) payload.route_id = route_id

  if (quickReplies && quickReplies.length > 0) {

    const validQuickReplies = quickReplies.map(text => (text || "").trim()).filter(text => text.length >= 1 && text.length <= MAX_QUICK_REPLY_LENGTH)

    if (validQuickReplies.length > 0) {
      if (validQuickReplies.length > MAX_QUICK_REPLIES_PER_MESSAGE) {
        // More than 3 options - use interactive list menu
        payload.route_params = {
          whatsapp: {
            list_button: {
              text: "Choose an option",
              items: validQuickReplies.map((text, index) => ({
                id: `option_${index}`,
                title: text,
              }))
            }
          }
        }
      } else {
        // 3 or fewer options - use simple quick reply buttons
        payload.route_params = {
          whatsapp: { quick_replies: validQuickReplies.map(text => ({ text: text })) }
        }
      }
    }
  }


  const r = await axios.post(telerivetUrl, payload, { headers: { 'Content-Type': 'application/json' } })

  return r.data

}


//Minimum required Interface. The other one shows everything
export interface TelerivetHookRequest {
  content?: string // "hola" - Con un audio esto viene vacio
  media?: TelerivetMedia[]
  time_created: string // "1769712063"
  from_number: string // "5492235...."
}


export interface TelerivetHookRequest {
  context: string // "message"
  event: "incoming_message"
  message_type: string // "chat"
  direction: string // "incoming"
  id: string // "SM5c9e459663433265"
  secret: string
  service_id: string
  phone_id: string // "PN64069cab4bbe0fa3"
  contact_id: string // "CTf792ef40a82984dc"
  status: string // "processing"
  source: string // "provider"
  time_updated: string // "1769712063"
  to_number: string // "15557750161"
  starred: string // "0"
  simulated: string // "0"
  track_clicks: string // "0"
  from_number_e164: string // "+5492235..."
  external_id: string // "wamid.HBgNNTQ5MjIzNTIxMjAwNxUCABIYFjNFQjBBRTVBMjI4RTQyMjY4QUYwQjgA"
  project_id: string // "PJ907db900079b5d05"
  contact: TelerivetContact
  state: TelerivetState
  phone: TelerivetPhone
  vars?: {
    reply_to?: string // "SMa32606ddb6d308ca"
  }
}
interface TelerivetContact {
  id: string// "CTf792ef40a82984dc",
  phone_number: string// "5492235...",
  name: string // "Guillermo",
  time_created: string // "1769710712",
  time_updated: string // "1769712063",
  message_count: string // "5",
  incoming_message_count: string // "3",
  outgoing_message_count: string // "2",
  send_blocked: string // "0",
  last_message_time: string // "1769712063",
  last_incoming_message_time: string // "1769712063",
  last_outgoing_message_time: string // "1769712031",
  last_message_id: string // "SM5c9e459663433265",
  conversation_status: string // "active",
  vars: {
    custom_uuid: string // "0a18ff81-8a38-4310-bc2c-d68d9d351199",
  },
  project_id: string// "PJ907db900079b5d05",
}
interface TelerivetState {
  contact_id: string // "CTf792ef40a82984dc",
  service_id: string // "SV9884cbe942921484",
  vars?: {
    initial: string // "1️⃣ New user",
  },
  time_created: string // "0",
  time_updated: string // "0",
  project_id: string // "PJ907db900079b5d05",
}
interface TelerivetPhone {
  id: string // "PN64069cab4bbe0fa3",
  name: string // "15557750161",
  phone_number: string // "15557750161",
  phone_type: string // "whatsapp",
  country: string // "US",
  time_created: string // "1756497931",
  send_paused: string // "0",
  project_id: string // "PJ907db900079b5d05",
  validate_recipient_numbers: string // "1",
  quiet_mode: string // "off",
}
interface TelerivetMedia {
  url: string // "https://telerivet.s3.amazonaws.com/files/PJ907db900079b5d05/1769712269/82a2f51b8145/image.jpg",
  type: string // "image/jpeg",
  filename: string // "image.jpg",
  size: string // "61572",
}
