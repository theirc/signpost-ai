import axios from "axios"
import { baseUrl } from "./config"

export interface SendDocumentMessageParams {
  phone: string
  token: string
  to: string
  link?: string
  id?: string
  caption?: string
  filename?: string
  context?: { message_id: string }
}

export async function sendDocumentMessage({ phone, token, to, link, id, caption, filename, context }: SendDocumentMessageParams): Promise<string> {

  try {

    if (!phone || !token || !to || (!link && !id)) return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Document: ${link || id || "Missing"}`

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "document",
      document: {
        ...(link && { link }),
        ...(id && { id }),
        ...(caption !== undefined && { caption }),
        ...(filename !== undefined && { filename }),
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
    return `Error sending document message: ${err}`
  }
}
