import { MAX_QUICK_REPLIES, MAX_QUICK_REPLY_LENGTH } from "./config"
import { post } from "./request"
import type { MessengerCredentials } from "./types"

export interface SendQuickRepliesMessageParams extends MessengerCredentials {
  to: string
  body: string
  quickReplies: string[]
}

// Messenger has no list picker: quick replies are the only option set, capped at 13 chips of 20 chars.
// Returns false when every option was invalid, so the caller can fall back to plain text.
export async function sendQuickRepliesMessage({ page_id, page_token, to, body, quickReplies }: SendQuickRepliesMessageParams) {

  const valid = normalizeQuickReplies(quickReplies)
  if (valid.length === 0) return false

  await post({ page_id, page_token }, {
    recipient: { id: to },
    messaging_type: "RESPONSE",
    message: {
      text: body || " ",
      quick_replies: valid.map(text => ({ content_type: "text", title: text, payload: text })),
    },
  })

  return true

}

export function normalizeQuickReplies(quickReplies: string[]): string[] {

  const valid = (quickReplies || []).map(text => (text || "").trim()).filter(text => text.length >= 1 && text.length <= MAX_QUICK_REPLY_LENGTH)

  if (valid.length > MAX_QUICK_REPLIES) {
    console.log(`[messenger] ${valid.length} quick replies, Messenger allows ${MAX_QUICK_REPLIES}: dropping the rest`)
    return valid.slice(0, MAX_QUICK_REPLIES)
  }

  return valid

}
