import { platforms } from "./config"
import { sendAttachmentMessage } from "./sendAttachmentMessage"
import { sendQuickRepliesMessage } from "./sendQuickRepliesMessage"
import { sendTextMessage, splitText } from "./sendTextMessage"
import type { MessengerAttachmentType, MessengerCredentials, MetaPlatform } from "./types"

interface SendParams extends MessengerCredentials {
  to: string
  message: string

  files?: string[]
  quickReplies?: string[]
  platform?: MetaPlatform
}

const attachmentTypes: { [ext: string]: MessengerAttachmentType } = {
  jpg: "image", jpeg: "image", png: "image", gif: "image", webp: "image",
  ogg: "audio", mp3: "audio", wav: "audio", m4a: "audio", aac: "audio",
  mp4: "video", "3gp": "video", mov: "video",
  txt: "file", xls: "file", xlsx: "file", doc: "file", docx: "file", ppt: "file", pptx: "file", pdf: "file",
}

export function attachmentType(url: string): MessengerAttachmentType {
  const ext = (url.split("?")[0].split(".").pop()?.toLowerCase() ?? "").trim()
  return attachmentTypes[ext] || "file"
}

export async function send({ page_id, page_token, to, message, files = [], quickReplies = [], platform = platforms.messenger }: SendParams) {

  message = (message || "").trim()

  // Instagram can't send documents, so their url is appended to the text instead of dropping the file.
  const links: string[] = []

  // Meta has no caption and no message header: every file is its own message and the text goes separately.
  for (const link of files) {
    const type = attachmentType(link)

    if (type === "file" && !platform.supportsFiles) {
      links.push(link)
      continue
    }

    try {
      await sendAttachmentMessage({ page_id, page_token, to, link, type })
    } catch (err) {
      // Meta is picky about audio containers (ogg/opus among them): retry as a plain file so the reply isn't lost.
      if (type !== "audio") throw err
      console.error(`[meta] audio attachment rejected, retrying as file: ${err}`)
      if (platform.supportsFiles) await sendAttachmentMessage({ page_id, page_token, to, link, type: "file" })
      else links.push(link)
    }
  }

  if (links.length > 0) message = [message, ...links].filter(Boolean).join("\n")

  if (quickReplies.length > 0) {
    // The chips ride along with the text, so a long answer goes out in pieces and only the last one carries them.
    const parts = splitText(message, platform.maxTextLength)
    const last = parts.pop() ?? " "
    for (const part of parts) await sendTextMessage({ page_id, page_token, to, body: part, maxTextLength: platform.maxTextLength })
    if (await sendQuickRepliesMessage({ page_id, page_token, to, body: last, quickReplies })) return
    await sendTextMessage({ page_id, page_token, to, body: last, maxTextLength: platform.maxTextLength })
    return
  }

  if (message) await sendTextMessage({ page_id, page_token, to, body: message, maxTextLength: platform.maxTextLength })

}
