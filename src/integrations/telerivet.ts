import { agents } from "../agents"
import { supabase } from "../agents/db"
import crypto from 'crypto'
import { env } from "../env"
import axios from "axios"
import { ulid } from "ulid"

const MAX_QUICK_REPLY_LENGTH = 20
const MAX_QUICK_REPLIES_PER_MESSAGE = 3
//agent 450

export async function telerivetHook(r: TelerivetHookRequest, agent: number) {

  if (!agent || !r) {
    console.log("Telerivet Error: No agent or request provided.")
    return
  }

  if (!r.media && !r.content) {
    console.log("Telerivet Error: No media or content provided.")
    return
  }

  if (!r.from_number) {
    console.log("Telerivet Error: No from number provided.")
    return
  }

  const dbAgent = await supabase.from("agents").select("*").eq("id", agent).single()
  if (!dbAgent.data || dbAgent.error) {
    console.log("Telerivet Error: No agent found.")
    return
  }

  const dbTeam = await supabase.from("teams").select("*").eq("id", dbAgent.data.team_id).single()
  if (!dbTeam.data || dbTeam.error) {
    console.log("Telerivet Error: No team found.")
    return
  }
  const team = dbTeam.data.id

  const a = await agents.loadAgent(agent, team)

  if (!a) {
    console.log("Telerivet Error: No agent by team found.")
    return
  }

  let apiKeys: APIKeys = {}
  const ak = await supabase.from("api_keys").select("*").eq("team_id", team)
  if (!ak.data || ak.error) {
    console.error('Telerivet Error: Error fetching api keys:')
    return
  }

  apiKeys = ak.data?.reduce<Record<string, string>>((acc, key) => {
    if (key.type && key.key) acc[key.type] = key.key
    return acc
  }, {}) || {}

  if (!apiKeys.telerivet) {
    console.log("Telerivet Error: No telerivet api key found.")
    return
  }

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

  if (p.error) {
    console.log(`Telerivet Error: Agent Error: ${p.error}  `)
    return
  }

  let { response, audio } = p.output || {}

  if (!response && !audio) {
    console.log("Telerivet Error: No output found.")
    return
  }

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

  await sendMessage(response || "", r.from_number, projectId, apiKeys.telerivet, quickReplies)

}


async function sendMessage(content: string, to_number: string, projectId: string, api_key: string, quickReplies: string[], media_url?: string) {

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


// async function execute(worker: MessageWorker) {

//   const quickReplies = worker.fields.quickReplies?.value as string[] || worker.parameters.defaultQuickReplies || []

//   // Then send text content with quick replies - split if too long
//   const cleanText = cleanMessage(processedContent)
//   const textMessages = splitMessageForWhatsApp(cleanText)

//   let lastApiResponse: any = null

//   for (let i = 0; i < textMessages.length; i++) {
//     const messageText = textMessages[i]
//     const quickRepliesForMessage = (i === textMessages.length - 1) ? quickReplies : []

//     const apiResponse = await sendTelerivetMessage(worker, toNumber, messageText, routeId, quickRepliesForMessage, [], isBrowser)
//     if (apiResponse) lastApiResponse = apiResponse

//     // Add delay between split messages if not the last one
//     if (i < textMessages.length - 1) {
//       await new Promise(resolve => setTimeout(resolve, 500))
//     }
//   }

//   // Set success output with actual API results
//   if (lastApiResponse) {
//     worker.fields.output.value = `Message sent successfully to ${toNumber}. API Response: ${JSON.stringify(lastApiResponse)}`
//   } else {
//     worker.fields.output.value = `Message sent successfully to ${toNumber}`
//   }





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
  from_number: string // "5492235212007"
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
  from_number_e164: string // "+5492235212007"
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
  phone_number: string// "5492235212007",
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

