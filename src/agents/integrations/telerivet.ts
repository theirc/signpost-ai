import axios from "axios"
import { isBrowser } from "../isbrowser"
import { codec } from "./encoder"

async function sendMessage(content: string, intPayload: IntegrationPayload) {

  const { phone: to_number, apiKey: api_key, projectId, route_id } = intPayload
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
  }

  const r = await axios.post(telerivetUrl, payload, { headers: { 'Content-Type': 'application/json' } })

  return r.data

}

async function sendMessageToContact(message: string, contact: Contact, codecKey: string) {
  const enc = await codec.decrypt(contact.data, codecKey)
  const payl = JSON.parse(enc) as IntegrationPayload
  await sendMessage(message, payl)
}



export const telerivet = {
  sendMessage,
  sendMessageToContact,
}

