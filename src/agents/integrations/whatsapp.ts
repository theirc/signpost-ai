import axios from "axios"

const baseUrl = "https://graph.facebook.com/v25.0"

async function sendTypingIndicator(phone: string, message_id: string, token: string): Promise<boolean> {

  try {

    if (!phone || !message_id || !token) {
      console.log(`Missing data: Phone: ${phone || "Missing"}, Message ID: ${message_id || "Missing"}, Token: ${token || "Missing"}`)
      return false
    }

    const typingPayload = {
      messaging_product: "whatsapp",
      status: "read",
      message_id,
      typing_indicator: {
        type: "text"
      }
    }

    const typingUrl = `${baseUrl}/${phone}/messages`

    const r = await axios.post(typingUrl,
      typingPayload,
      {
        headers: {
          "Authorization": "Bearer " + token,
          "Content-Type": "application/json"
        }
      })

    return r.status === 200
  } catch (err) {
    console.error(`Error contacting whatsapp: ${err}`)
    return false
  }

}

export const whatsapp = {
  sendTypingIndicator,
}

