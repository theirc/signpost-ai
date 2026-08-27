import axios from "axios"
import { baseUrl } from "./config"

export interface SendAudioMessageParams {
  phone: string
  token: string
  to: string
  link?: string
  id?: string
  context?: { message_id: string }
  voice?: boolean
}

export async function sendAudioMessage({ phone, token, to, link, id, context, voice }: SendAudioMessageParams): Promise<string> {

  try {

    if (!phone || !token || !to || (!link && !id)) return `Missing data: Phone: ${phone || "Missing"}, Token: ${token || "Missing"}, To: ${to || "Missing"}, Audio: ${link || id || "Missing"}`

    phone = phone.replace("+", "").trim()

    const payload: Record<string, unknown> = {
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to,
      type: "audio",
      audio: {
        ...(link && { link }),
        ...(id && { id }),
        ...(voice && { voice }),
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
    return `Error sending audio message: ${err}`
  }
}
