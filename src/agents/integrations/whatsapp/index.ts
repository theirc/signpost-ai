import { sendTypingIndicator } from "./sendTypingIndicator"
import { sendTextMessage } from "./sendTextMessage"
import { sendAudioMessage } from "./sendAudioMessage"
import { sendDocumentMessage } from "./sendDocumentMessage"
import { sendImageMessage } from "./sendImageMessage"
import { sendVideoMessage } from "./sendVideoMessage"
import { sendInteractiveListMessage } from "./sendInteractiveListMessage"
import { sendInteractiveReplyButtonsMessage } from "./sendInteractiveReplyButtonsMessage"


interface SendParams {
  phone: string
  token: string

  to: string
  message: string

  message_id?: string

  files: string[]
  quickReplies: string[]
}

async function send({ phone, to, token, message, files = [], quickReplies = [], message_id }: SendParams) {

  message ||= ""
  message = message.trim()

  const documents: string[] = []
  const audios: string[] = []
  const voice: string[] = []
  const images: string[] = []
  const videos: string[] = []


  for (const file of files) {
    const ext = (file.split('.').pop()?.toLowerCase() ?? '').trim()
    if (ext === 'ogg') voice.push(file)
    else if (['jpg', 'jpeg', 'png'].includes(ext)) images.push(file)
    else if (['wav', 'mp3'].includes(ext)) audios.push(file)
    else if (['3gp', 'mp4'].includes(ext)) videos.push(file)
    else if (['txt', 'xls', 'xlsx', 'doc', 'docx', 'ppt', 'pptx', 'pdf'].includes(ext)) documents.push(file)
  }

  for (const link of documents) {
    await sendDocumentMessage({ phone, token, to, link })
  }

  for (const link of images) {
    await sendImageMessage({ phone, token, to, link })
  }

  for (const link of videos) {
    await sendVideoMessage({ phone, token, to, link })
  }

  for (const link of audios) {
    await sendAudioMessage({ phone, token, to, link })
  }

  for (const link of voice) {
    await sendAudioMessage({ voice: true, phone, token, to, link })
  }

  if (quickReplies.length > 0) {
    const body = message || " "

    if (quickReplies.length <= 3) {
      await sendInteractiveReplyButtonsMessage({
        phone, token, to, body,
        buttons: quickReplies.map((r) => ({ id: r, title: r })),
        ...(message_id && { context: { message_id } }),
      })
    } else {
      await sendInteractiveListMessage({
        phone, token, to, body,
        button: "Options",
        sections: [{ rows: quickReplies.map((r) => ({ id: r, title: r })) }],
        ...(message_id && { context: { message_id } }),
      })
    }
  }

  if (message && quickReplies.length === 0) {
    await sendTextMessage({ phone, token, to, body: message })
  }

  return null
}

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
}
