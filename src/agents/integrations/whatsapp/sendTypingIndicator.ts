import axios from "axios"
import { baseUrl } from "./config"

export interface SendTypingIndicatorParams {
  phone: string
  message_id: string
  token: string
}

export async function sendTypingIndicator({ phone, message_id, token }: SendTypingIndicatorParams): Promise<boolean> {
  try {
    if (!phone || !message_id || !token) {
      console.log(`Missing data: Phone: ${phone || "Missing"}, Message ID: ${message_id || "Missing"}, Token: ${token || "Missing"}`)
      return false
    }

    console.log(`Sending to: 
      Phone: ${phone || "Missing"} 
      Message ID: ${message_id || "Missing"}
      Token: ${token || "Missing"}`)

    phone = phone.replace("+", "").trim()

    const typingPayload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id,
      typing_indicator: {
        type: "text"
      }
    }

    const r = await axios.post(`${baseUrl}/${phone}/messages`,
      typingPayload,
      {
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      })

    return r.status === 200
  } catch (err) {
    console.error(`Error sending typing indicator: ${err}`)
    return false
  }
}
