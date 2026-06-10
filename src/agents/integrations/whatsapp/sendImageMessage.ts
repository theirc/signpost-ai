import axios from "axios"
import { baseUrl } from "./config"

export interface SendImageMessageParams {
  phone: string
  token: string
  to: string
  link?: string
  id?: string
  caption?: string
  context?: { message_id: string }
}

export async function sendImageMessage({ phone, token, to, link, id, caption, context }: SendImageMessageParams): Promise<string> {


  try {
    if (!phone || !token || !to || (!link && !id)) {
      return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Image: ${link || id || "Missing"}`
    }

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "image",
      image: {
        ...(link && { link }),
        ...(id && { id }),
        ...(caption !== undefined && { caption }),
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
    return `Error sending image message: ${err}`
  }
}
