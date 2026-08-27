import axios from "axios"
import { baseUrl } from "./config"

export interface InteractiveListRow {
  id: string
  title: string
  description?: string
}

export interface InteractiveListSection {
  title?: string
  rows: InteractiveListRow[]
}

export interface SendInteractiveListMessageParams {
  phone: string
  token: string
  to: string
  button: string
  sections: InteractiveListSection[]
  body: string
  header?: string
  footer?: string
  context?: { message_id: string }
}

export async function sendInteractiveListMessage({ phone, token, to, button, sections, body, header, footer, context }: SendInteractiveListMessageParams): Promise<string> {

  try {

    if (!phone || !token || !to || !button || !body || !sections?.length) return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Button: ${button || "Missing"}, Body: ${body || "Missing"}`

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "list",
        ...(header !== undefined && { header: { type: "text", text: header } }),
        body: { text: body },
        ...(footer !== undefined && { footer: { text: footer } }),
        action: { button, sections },
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
    return `Error sending interactive list message: ${err}`
  }
}
