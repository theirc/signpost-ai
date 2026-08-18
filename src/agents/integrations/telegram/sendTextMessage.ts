import { MAX_TEXT_LENGTH } from "./config"
import { post } from "./request"

export interface SendTextMessageParams {
  token: string
  to: string
  body: string
  quickReplies?: string[]
}

export async function sendTextMessage({ token, to, body, quickReplies = [] }: SendTextMessageParams) {

  const parts = splitText(body)
  if (parts.length === 0 && quickReplies.length === 0) return
  if (parts.length === 0) parts.push("...")

  for (let i = 0; i < parts.length; i++) {
    const payload: any = { chat_id: to, text: parts[i] }
    // The keyboard belongs to the last message, so it isn't replaced halfway through a long answer.
    if (i === parts.length - 1 && quickReplies.length > 0) payload.reply_markup = replyKeyboard(quickReplies)
    await post(token, "sendMessage", payload)
  }

}

// A reply keyboard sends the tapped label back as a normal message, which is how quick replies behave
// on the other channels. Inline keyboards would arrive as callback queries instead.
function replyKeyboard(quickReplies: string[]) {
  return {
    keyboard: quickReplies.map(text => [{ text }]),
    one_time_keyboard: true,
    resize_keyboard: true,
  }
}

export function splitText(text: string, maxLength: number = MAX_TEXT_LENGTH): string[] {

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
