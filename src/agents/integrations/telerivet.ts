import axios from "axios"

async function sendMessage(content: string, intPayload: TelerivetIntegrationPayload) {

  const { phone: destination, apiKey: api_key, projectId } = intPayload
  if (!content) return

  const telerivetUrl = `https://api.telerivet.com/v1/projects/${projectId}/messages/send`

  const payload: any = {
    content,
    to_number: destination,
    message_type: "text",
    api_key,
  }

  const r = await axios.post(telerivetUrl, payload, { headers: { 'Content-Type': 'application/json' } })

  return r.data

}

export const telerivet = {
  sendMessage,
}

