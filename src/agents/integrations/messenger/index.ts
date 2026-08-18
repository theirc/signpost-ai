import { send } from "./send"
import { sendAttachmentMessage } from "./sendAttachmentMessage"
import { sendQuickRepliesMessage } from "./sendQuickRepliesMessage"
import { sendTextMessage } from "./sendTextMessage"
import { sendTypingIndicator } from "./sendTypingIndicator"
import { getProfile } from "./getProfile"

export const messenger = {
  send,
  sendAttachmentMessage,
  sendQuickRepliesMessage,
  sendTextMessage,
  sendTypingIndicator,
  getProfile,
}
