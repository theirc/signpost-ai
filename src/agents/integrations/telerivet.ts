import axios from "axios"
import { isBrowser } from "../isbrowser"
import { codec } from "./encoder"

interface TelerivetMessage {
  id?: string
  direction?: "incoming" | "outgoing"
  status?: "ignored" | "processing" | "received" | "sent" | "queued" | "failed" | "failed_queued" | "cancelled" | "delivered" | "not_delivered" | "read"
  message_type?: "sms" | "mms" | "ussd" | "ussd_session" | "call" | "chat" | "service"
  source?: "phone" | "provider" | "web" | "api" | "service" | "webhook" | "scheduled" | "integration" | "mcp"
  time_created?: number
  time_sent?: number
  time_updated?: number
  from_number?: string
  to_number?: string
  content?: string
  starred?: boolean
  simulated?: boolean
  label_ids?: string[]
  route_params?: any
  vars?: { [index: string]: string }
  priority?: number
  send_attempts?: number
  external_id?: string
  num_parts?: number
  price?: number
  price_currency?: string
  duration?: number
  ring_time?: number
  audio_url?: string
  tts_lang?: string
  tts_voice?: "female" | "male"
  track_clicks?: boolean
  short_urls?: string[]
  network_code?: string
  media?: any[]
  mms_parts?: any[]
  time_clicked?: number
  service_id?: string
  phone_id?: string
  contact_id?: string
  route_id?: string
  broadcast_id?: string
  scheduled_id?: string
  user_id?: string
  project_id?: string
  url?: string
}

async function sendMessage(content: string, intPayload: IntegrationPayload) {

  const { phone: to_number, apiKey: api_key, projectId, route_id, contact_id } = intPayload
  if (!content) return
  let decors = ""

  if (isBrowser) decors = `https://signpost-ia-app-qa.azurewebsites.net/decorsify/`

  const telerivetUrl = `${decors}https://api.telerivet.com/v1/projects/${projectId}/messages/send`

  const payload: any = {
    content,
    to_number,
    message_type: "text",
    api_key,
    route_id,
    contact_id,
  }

  const r = await axios.post(telerivetUrl, payload, { headers: { 'Content-Type': 'application/json' } })

  return r.data

}

async function getMessageStatus(project_id: string, message_id: string) {
  const telerivetUrl = `https://api.telerivet.com/v1/projects/${project_id}/messages/${message_id}`
  const r = await axios.get(telerivetUrl, { headers: { 'Content-Type': 'application/json' } })
  return r.data as TelerivetMessage
}

async function sendMessageToContact(message: string, contact: Contact, codecKey: string) {
  const enc = await codec.decrypt(contact.data, codecKey)
  const payl = JSON.parse(enc) as IntegrationPayload
  await sendMessage(message, payl)
}


export const telerivet = {
  sendMessage,
  sendMessageToContact,
  getMessageStatus,
}

