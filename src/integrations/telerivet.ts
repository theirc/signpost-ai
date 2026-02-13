import { agents } from "../agents"
import { supabase } from "../agents/db"
import crypto from 'crypto'
import { env } from "../env"
import axios from "axios"
import { ulid } from "ulid"

const MAX_QUICK_REPLY_LENGTH = 20
const MAX_QUICK_REPLIES_PER_MESSAGE = 3

export async function telerivetHook(r: TelerivetHookRequest, agent: number, debug = false) {

  let error: string

  try {
    error = await internalTelerivetHook(r, agent)
  } catch (error) {
    error = `Catch Error: ${error || "Unknown error"}`
  }

  console.log(`Telerivet: ${error ? error : "No incidents recorded."}`)

  if (debug && error) {
    try {
      tryToNotifiyError(error, r, agent)
    } catch (error) {
      console.error("Error sending error")
    }
  }

}

async function tryToNotifiyError(error: string, r: TelerivetHookRequest, agent: number) {

  const dbAgent = await supabase.from("agents").select("*").eq("id", agent).single()
  const dbTeam = await supabase.from("teams").select("*").eq("id", dbAgent.data.team_id).single()
  const team = dbTeam.data.id
  const ak = await supabase.from("api_keys").select("*").eq("team_id", team)

  let apiKeys: APIKeys = {}

  apiKeys = ak.data?.reduce<Record<string, string>>((acc, key) => {
    if (key.type && key.key) acc[key.type] = key.key
    return acc
  }, {}) || {}

  await sendMessage(error, r.from_number, r.project_id, apiKeys.telerivet, [])

}


async function internalTelerivetHook(r: TelerivetHookRequest, agent: number) {

  if (!agent || !r) return "No agent or request provided."
  if (!r.media && !r.content) return "No media or content provided."
  if (!r.from_number) return "No from number provided."

  const dbAgent = await supabase.from("agents").select("*").eq("id", agent).single()
  if (!dbAgent.data || dbAgent.error) return "No agent by id found."

  const dbTeam = await supabase.from("teams").select("*").eq("id", dbAgent.data.team_id).single()
  if (!dbTeam.data || dbTeam.error) return "No team found."
  const team = dbTeam.data.id

  const a = await agents.loadAgent(agent, team)

  if (!a) return "No agent found."

  let apiKeys: APIKeys = {}
  const ak = await supabase.from("api_keys").select("*").eq("team_id", team)
  if (!ak.data || ak.error) return "No api keys found."

  apiKeys = ak.data?.reduce<Record<string, string>>((acc, key) => {
    if (key.type && key.key) acc[key.type] = key.key
    return acc
  }, {}) || {}

  if (!apiKeys.telerivet) return "No telerivet api key found."

  //----- Real processing starts here ------------------------------------------------------------------------------------------------------------------------------------------

  let inputAudio: AgentAudio
  const files = []

  if (r.media && r.media.length > 0) {
    const media = r.media[0]
    if (media.type == "audio/ogg") {
      const fileContent = await axios.get(media.url, { responseType: 'arraybuffer' })
      const base64String = Buffer.from(fileContent.data).toString('base64')
      inputAudio = {
        audio: base64String,
        ext: "ogg"
      }
    }

    for (let i = 1; i < r.media.length; i++) {
      const media = r.media[i]
      if (media.type != "audio/ogg") files.push(media)
    }

  }

  const uid = encode(r.from_number)
  let content = r.content || ""
  content = content.trim()
  const projectId = r.project_id

  if (content == "/reset") {
    await a.resetAgent(uid)
    await sendMessage("The chat history has been reset.", r.from_number, projectId, apiKeys.telerivet, [])
    return
  }

  const p: AgentParameters = {
    input: {
      message: content,
      files,
    },
    apiKeys,
    uid,
  }

  if (inputAudio) p.input.audio = inputAudio
  await a.execute(p)
  if (p.error) return `Agent Error: ${p.error}`

  let { response, audio } = p.output || {}

  if (!response && !audio) return "No output found"

  const media_urls: string[] = []

  // Extract all image URLs from response (both markdown and plain URLs)
  if (response) {
    // First, extract markdown image URLs: ![alt](url)
    const markdownImageRegex = /!\[.*?\]\((https?:\/\/[^\)]+\.(jpg|jpeg|png|gif)(?:\?[^\)]*)?)\)/gi
    let match
    while ((match = markdownImageRegex.exec(response)) !== null) {
      media_urls.push(match[1])
    }
    // Remove markdown images from response
    response = response.replace(/!\[.*?\]\(https?:\/\/[^\)]+\.(jpg|jpeg|png|gif)(?:\?[^\)]*)?\)/gi, '').trim()

    // Then, extract plain image URLs (not in markdown format)
    const plainImageRegex = /(?<!\]\()https?:\/\/[^\s<>]+\.(jpg|jpeg|png|gif)(?:\?[^\s<>]*)?\b/gi
    while ((match = plainImageRegex.exec(response)) !== null) {
      media_urls.push(match[0])
    }
    // Remove plain image URLs from response
    response = response.replace(/https?:\/\/[^\s<>]+\.(jpg|jpeg|png|gif)(?:\?[^\s<>]*)?\b/gi, '').trim()
  }

  const quickReplies: string[] = []
  if (response) {
    const bracketedRegex = /\[([^\]]+)\]/g
    let match
    while ((match = bracketedRegex.exec(response)) !== null) {
      quickReplies.push(match[1])
    }
    // Remove all [bracketed] text from response
    response = response.replace(/\[[^\]]+\]/g, '').trim()
  }


  if (audio) {
    const base64String = audio.audio
    const f = await supabase.storage.from('temp').upload(`${ulid()}.ogg`, Buffer.from(base64String, 'base64'), { contentType: 'audio/ogg' })
    const { data } = supabase.storage.from('temp').getPublicUrl(f.data.path)
    media_urls.push(data.publicUrl)
  }

  if (media_urls.length > 0) {
    console.log(`[Telerivet] Found ${media_urls.length} image(s)`)
    for (const url of media_urls) {
      await sendMessage("", r.from_number, projectId, apiKeys.telerivet, [], url)
    }
  }

  response = response || ""

  if (response.includes("<break>")) {
    const parts = response.split("<break>").map((p: string) => p.trim()).filter(p => p.length > 0)
    for (let i = 0; i < parts.length - 1; i++) {
      await sendMessage(parts[i], r.from_number, projectId, apiKeys.telerivet, [])
    }
    if (parts.length > 0) await sendMessage(parts[parts.length - 1], r.from_number, projectId, apiKeys.telerivet, quickReplies)
  } else {
    await sendMessage(response, r.from_number, projectId, apiKeys.telerivet, quickReplies)
  }

}


async function sendMessage(content: string, to_number: string, projectId: string, api_key: string, quickReplies: string[], media_url?: string) {

  if (!content && !media_url) return

  const telerivetUrl = `https://api.telerivet.com/v1/projects/${projectId}/messages/send`

  const payload: any = {
    content,
    to_number,
    message_type: "text",
    api_key,
  }

  if (media_url) payload.media_urls = [media_url]

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


function encode(text: string): string {
  const password = env.TELERIVET_SALT
  const key = crypto.createHash('md5').update(password).digest()
  const cipher = crypto.createCipheriv('aes-128-ecb', key, null)
  const encrypted = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()])
  return encrypted.toString('base64url')
}

function decode(encoded: string): string {
  const password = env.TELERIVET_SALT
  const key = crypto.createHash('md5').update(password).digest()
  const decipher = crypto.createDecipheriv('aes-128-ecb', key, null)
  const decrypted = Buffer.concat([decipher.update(encoded, 'base64url'), decipher.final()])
  return decrypted.toString('utf8')
}


interface TelerivetHookRequest {
  content?: string // "hola" - Con un audio esto viene vacio
  media?: TelerivetMedia[]
  time_created: string // "1769712063"
  from_number: string // "5492235...."
}


interface TelerivetHookRequest {
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
  //url: "https://telerivet.s3.amazonaws.com/files/PJ907db900079b5d05/1769712326/8cbf2637e44f/audio.ogg",
  type: string // "image/jpeg",
  // type: "audio/ogg",
  filename: string // "image.jpg",
  //filename: "audio.ogg",
  size: string // "61572",
  // size: "2450",
}



interface AgentAudio {
  audio?: string
  ext?: string
}

