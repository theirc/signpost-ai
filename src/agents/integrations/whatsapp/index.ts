import { sendTypingIndicator } from "./sendTypingIndicator"
import { sendTextMessage } from "./sendTextMessage"
import { sendAudioMessage } from "./sendAudioMessage"
import { sendDocumentMessage } from "./sendDocumentMessage"
import { sendImageMessage } from "./sendImageMessage"
import { sendVideoMessage } from "./sendVideoMessage"
import { sendInteractiveListMessage } from "./sendInteractiveListMessage"
import { sendInteractiveReplyButtonsMessage } from "./sendInteractiveReplyButtonsMessage"
import { processHook } from "./hook"
import { send } from "./send"

export const whatsapp = {
  send,
  sendTypingIndicator,
  sendTextMessage,
  sendAudioMessage,
  sendDocumentMessage,
  sendImageMessage,
  sendVideoMessage,
  sendInteractiveListMessage,
  sendInteractiveReplyButtonsMessage,
  processHook,
}
