import { platforms } from "./config"
import { post } from "./request"
import type { MessengerCredentials } from "./types"

export interface SendTextMessageParams extends MessengerCredentials {
  to: string
  body: string
  maxTextLength?: number
}

export async function sendTextMessage({ page_id, page_token, to, body, maxTextLength }: SendTextMessageParams) {
  for (const part of splitText(body, maxTextLength)) {
    await post({ page_id, page_token }, { recipient: { id: to }, messaging_type: "RESPONSE", message: { text: part } })
  }
}

// Meta rejects text over the platform limit (2000 on Messenger, 1000 on Instagram),
// so long answers go out as consecutive messages, cut on word boundaries.
export function splitText(text: string, maxLength: number = platforms.messenger.maxTextLength): string[] {

  text = (text || "").trim()
  if (!text) return []
  if (text.length <= maxLength) return [text]

  const parts: string[] = []
  let remaining = text

  while (remaining.length > 0) {
    let chunk = remaining.substring(0, maxLength)
    if (remaining.length > maxLength) {
      const lastSpace = chunk.lastIndexOf(" ")
      if (lastSpace > maxLength * 0.5) chunk = chunk.substring(0, lastSpace)
    }
    parts.push(chunk.trim())
    remaining = remaining.substring(chunk.length).trim()
  }

  return parts.filter(Boolean)

}
