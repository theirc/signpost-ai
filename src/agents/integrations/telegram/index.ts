import { send } from "./send"
import { sendTextMessage } from "./sendTextMessage"
import { sendMediaMessage } from "./sendMediaMessage"
import { sendChatAction } from "./sendChatAction"
import { downloadFile } from "./downloadFile"

export const telegram = {
  send,
  sendTextMessage,
  sendMediaMessage,
  sendChatAction,
  downloadFile,
}
