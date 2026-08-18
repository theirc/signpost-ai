import { post } from "./request"
import type { MessengerCredentials } from "./types"

export interface SendTypingIndicatorParams extends MessengerCredentials {
  to: string
}

// Unlike Whatsapp, sender actions are per conversation, not per message id.
export async function sendTypingIndicator({ page_id, page_token, to }: SendTypingIndicatorParams): Promise<boolean> {
  try {
    if (!page_id || !page_token || !to) {
      console.log(`Missing data for Messenger: Page ID: ${page_id || "Missing"}, Page Token: ${page_token || "Missing"}, To: ${to || "Missing"}`)
      return false
    }

    await post({ page_id, page_token }, { recipient: { id: to }, sender_action: "mark_seen" })
    await post({ page_id, page_token }, { recipient: { id: to }, sender_action: "typing_on" })

    return true
  } catch (err) {
    console.error(`Error sending typing indicator: ${err}`)
    return false
  }
}
