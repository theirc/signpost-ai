import axios from "axios"
import { baseUrl } from "./config"

export interface InteractiveReplyButton {
  id: string
  title: string
}

export interface SendInteractiveReplyButtonsMessageParams {
  phone: string
  token: string
  to: string
  body: string
  buttons: InteractiveReplyButton[]
  header?: { type: "text"; text: string } | { type: "image" | "video" | "document"; link: string }
  footer?: string
  context?: { message_id: string }
}

export async function sendInteractiveReplyButtonsMessage({ phone, token, to, body, buttons, header, footer, context }: SendInteractiveReplyButtonsMessageParams): Promise<string> {

  try {

    if (!phone || !token || !to || !body || !buttons?.length) return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Body: ${body || "Missing"}`

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "interactive",
      interactive: {
        type: "button",
        ...(header !== undefined && { header }),
        body: { text: body },
        ...(footer !== undefined && { footer: { text: footer } }),
        action: {
          buttons: buttons.slice(0, 3).map((btn) => ({
            type: "reply",
            reply: { id: btn.id, title: btn.title },
          })),
        },
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
    return `Error sending interactive reply buttons message: ${err}`
  }
}
