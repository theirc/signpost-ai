import axios from "axios"
import { baseUrl } from "./config"

export interface SendTextMessageParams {
  phone: string
  token: string
  to: string
  body: string
  preview_url?: boolean
  context?: { message_id: string }
}

export async function sendTextMessage({ phone, token, to, body, preview_url, context }: SendTextMessageParams): Promise<string> {

  try {

    if (!phone || !token || !to || !body) return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Body: ${body || "Missing"}`

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "text",
      text: {
        body,
        ...(preview_url !== undefined && { preview_url }),
      },
    }

    if (context) payload.context = context

    const r = await axios.post(`${baseUrl}/${phone}/messages`, payload, {
      headers: {
        "Authorization": "Bearer " + token,
        "Content-Type": "application/json",
      },
    })

  } catch (err) {
    return `Whatsapp: Error sending text message: ${err}`
  }

}
