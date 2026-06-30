import axios from "axios"
import { agents } from "../../agent"
import { supabase } from "../../db"
import { send } from "./send"
import { sendTypingIndicator } from "./sendTypingIndicator"

interface WhatsAppMediaMessage {
  id: string
  mime_type: string
  sha256: string
  caption?: string
  filename?: string
  voice?: boolean
}

interface WhatsAppError {
  code: number
  title: string
  message?: string
  error_data?: {
    details: string
  }
}

interface WhatsAppMessage {
  id: string
  from: string
  timestamp: string
  type: "text" | "image" | "audio" | "video" | "document" | "sticker" | "location" | "contacts" | "interactive" | "button" | "reaction" | "order" | "system" | "unknown"
  context?: {
    from: string
    id: string
    forwarded?: boolean
    frequently_forwarded?: boolean
    referred_product?: {
      catalog_id: string
      product_retailer_id: string
    }
  }
  text?: {
    body: string
  }
  image?: WhatsAppMediaMessage
  audio?: WhatsAppMediaMessage
  video?: WhatsAppMediaMessage
  document?: WhatsAppMediaMessage
  sticker?: WhatsAppMediaMessage
  location?: {
    latitude: number
    longitude: number
    name?: string
    address?: string
  }
  interactive?: {
    type: "button_reply" | "list_reply"
    button_reply?: {
      payload: string
      text: string
      title: string
    }
    list_reply?: {
      id: string
      title: string
      description?: string
    }
  }
  button?: {
    payload: string
    text: string
  }
  reaction?: {
    message_id: string
    emoji: string
  }
  errors?: WhatsAppError[]
}

export interface WhatsAppWebhookPayload {
  object: "whatsapp_business_account"
  entry: {
    id: string
    changes: {
      field: string
      value: {
        messaging_product: "whatsapp"
        metadata: {
          display_phone_number: string
          phone_number_id: string
        }
        contacts?: {
          profile: {
            name: string
          }
          wa_id: string
        }[]
        messages?: WhatsAppMessage[]
        statuses?: {
          id: string
          status: "sent" | "delivered" | "read" | "failed"
          timestamp: string
          recipient_id: string
          conversation?: {
            id: string
            origin: {
              type: string
            }
            expiration_timestamp?: string
          }
          pricing?: {
            billable: boolean
            pricing_model: string
            category: string
          }
          errors?: WhatsAppError[]
        }[]
        errors?: WhatsAppError[]
      }
    }[]
  }[]
}

interface ProcessHookParams {
  agent: number
  payload: WhatsAppWebhookPayload
  debug?: boolean
}

export async function processHook({ agent, payload, debug }: ProcessHookParams) {

  const hasMessages = payload?.entry?.[0]?.changes?.[0]?.value?.messages
  if (!hasMessages) return

  let error: string

  try {
    error = await internalProcessHook({ agent, payload })
  } catch (error) {
    error = `Whatsapp Hook Error: ${error || "Unknown error"}`
  }

  if (error) console.error(`Whatsapp: ${error}`)

  if (debug && error) {
    try {
      tryToNotifiyError(error, { agent, payload })
    } catch (error) {
      console.error(`Error sending Whatsapp Notification error ${error}`)
    }
  }

}

async function internalProcessHook({ agent, payload }: ProcessHookParams) {

  if (!agent || !payload) return "No agent or payload provided."

  const value = payload?.entry?.[0]?.changes?.[0]?.value
  const message = value?.messages?.[0]
  if (!message) return "No message provided."

  const from = message.from
  if (!from) return "No from number provided."

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

  const message_id = message.id
  const whatsapp_phone_id = a.integrations?.whatsapp_phoneid || apiKeys.whatsapp_phone
  const whatsapp_token = a.integrations?.whatsapp_token || apiKeys.whatsapp

  let inputAudio: { audio: string, ext: string }
  let content = ""
  const files: { url: string, type: string, filename?: string }[] = []

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
          inputAudio = { audio: Buffer.from(fileContent.data).toString("base64"), ext: "ogg" }
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

  await sendTypingIndicator({
    message_id,
    phone: whatsapp_phone_id,
    token: whatsapp_token
  })

  //------------------------------------------------------------------------------------------------------------------------------

  const p: AgentParameters = {
    input: {
      message: content,
      files,
    },
    integration: {
      name: contactName,
      phone: from,
      type: "whatsapp",
      message_id: message.id,
    },
    apiKeys,
  }
  if (inputAudio) p.input.audio = inputAudio

  await a.execute(p)
  if (p.error) return `Agent Error: ${p.error}`

  //------------------------------------------------------------------------------------------------------------------------------

  let { response } = p.output || {}
  const media_urls: string[] = p.output.files || []
  const quickReplies: string[] = p.output.quickreplies || []

  await send({
    token: whatsapp_token,
    phone: whatsapp_phone_id,
    to: from,
    message: response,
    files: media_urls,
    quickReplies,
    message_id,
  })

}

async function getMediaUrl(mediaId: string, token: string): Promise<string> {
  try {
    const r = await axios.get(`https://graph.facebook.com/v25.0/${mediaId}`, { headers: { Authorization: "Bearer " + token } })
    return r.data?.url
  } catch (err) {
    console.error(`Error getting media url: ${err}`)
    return null
  }
}


async function tryToNotifiyError(error: string, { agent, payload }: ProcessHookParams) {

  if (!agent || !payload) return

  const value = payload?.entry?.[0]?.changes?.[0]?.value
  const message = value?.messages?.[0]
  const from = message.from
  if (!from) return

  const dbAgent = await supabase.from("agents").select("*").eq("id", agent).single()
  if (!dbAgent.data || dbAgent.error) return

  const dbTeam = await supabase.from("teams").select("*").eq("id", dbAgent.data.team_id).single()
  if (!dbTeam.data || dbTeam.error) return
  const team = dbTeam.data.id

  const a = await agents.loadAgent(agent, team)
  if (!a) return

  const message_id = message.id
  const whatsapp_phone_id = a.integrations?.whatsapp_phoneid
  const whatsapp_token = a.integrations?.whatsapp_token

  await send({
    token: whatsapp_token,
    phone: whatsapp_phone_id,
    to: from,
    message: error,
    message_id,
  })

}
