import { post } from "./request"
import type { MessengerCredentials, MessengerAttachmentType } from "./types"

export interface SendAttachmentMessageParams extends MessengerCredentials {
  to: string
  link: string
  type: MessengerAttachmentType
}

// Messenger only accepts attachments by public URL and has no caption field: text always travels in its own message.
export async function sendAttachmentMessage({ page_id, page_token, to, link, type }: SendAttachmentMessageParams) {
  await post({ page_id, page_token }, {
    recipient: { id: to },
    messaging_type: "RESPONSE",
    message: { attachment: { type, payload: { url: link, is_reusable: true } } },
  })
}
