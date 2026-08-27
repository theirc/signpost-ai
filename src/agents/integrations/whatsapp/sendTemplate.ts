import axios from "axios"
import { baseUrl } from "./config"

export interface SendTemplateParams {
  phone: string
  token: string
  to: string
  template: string
  language?: string
  components?: any
  context?: { message_id: string }
}

export async function sendTemplate({ phone, token, to, template, language, components, context }: SendTemplateParams): Promise<string> {

  try {

    if (!phone || !token || !to || !template) return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Template: ${template || "Missing"}`

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "template",
      template: {
        name: template,
        language: { code: language || "en_US" },
        ...(components !== undefined && { components }),
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
    return `Whatsapp: Error sending template message: ${err}`
  }

}
