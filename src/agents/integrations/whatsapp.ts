import axios from "axios"

const baseUrl = "https://graph.facebook.com/v25.0"

async function sendTypingIndicator(phone: string, message_id: string, token: string): Promise<boolean> {

  phone = "575076972363150"

  try {

    if (!phone || !message_id || !token) {
      console.log(`Missing data: Phone: ${phone || "Missing"}, Message ID: ${message_id || "Missing"}, Token: ${token || "Missing"}`)
      return false
    }

    console.log(`Sending to: 
      Phone: ${phone || "Missing"} 
      Message ID: ${message_id || "Missing"}
      Token: ${token || "Missing"}`)

    phone = phone.replace("+", "")
    phone = phone.trim()

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
    console.error(`Error contacting whatsapp: ${err}`)
    return false
  }

}

export const whatsapp = {
  sendTypingIndicator,
}

