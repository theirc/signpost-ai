import { post } from "./request"

export interface SendChatActionParams {
  token: string
  to: string
  action?: string
}

export async function sendChatAction({ token, to, action = "typing" }: SendChatActionParams): Promise<boolean> {
  try {
    if (!token || !to) {
      console.log(`Missing data for Telegram: Token: ${token ? "Ok" : "Missing"}, To: ${to || "Missing"}`)
      return false
    }
    await post(token, "sendChatAction", { chat_id: to, action })
    return true
  } catch (err) {
    console.error(`Error sending chat action: ${err}`)
    return false
  }
}
