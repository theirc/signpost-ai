import axios from "axios"
import { workers } from "./workers"
import path from 'path'
import { audio } from "../audio"

const headers = {
  Authorization: "Basic " + Buffer.from(`${process.env.ZENDESK_ACCOUNT}/token` + ':' + process.env.ZENDESK_TOKEN).toString('base64'),
  "Content-Type": "application/json"
}

const audioLinkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)(?:\.mp3|\.wav|\.ogg|\.aac|\.m4a|\.oga)/gi
const fileLinkRegex = /https?:\/\/(www\.)?[-a-zA-Z0-9@:%._\+~#=]{1,256}\.[a-zA-Z0-9()]{1,6}\b([-a-zA-Z0-9()@:%_\+.~#?&//=]*)/gi

interface ZendeskComment {
  author_id?: number
  body?: string
  html_body?: string
  created_at?: string
  attachments?: Attachment[]
}
interface Attachment {
  id?: number
  url?: string
  file_name?: string
  content_url?: string
  content_type?: string //audio/wav
  size?: number
}
interface ZendeskCommentsResponse {
  comments?: ZendeskComment[],
  next_page?: string
  previous_page?: string
  count?: number
}
interface UploadResponse {

  upload: {
    token: string
    expires_at: string
    attachments: [
      {
        url: string
        id: number
        file_name: "tts.mp3",
        content_url: string
        mapped_content_url: string
        content_type: string
        size: number
        width: number
        height: number
        inline: boolean
        deleted: boolean
        malware_access_override: boolean
        malware_scan_result: string // "not_scanned",
        thumbnails: string[],
      },
    ],
    attachment: {
      url: string
      id: number
      file_name: string
      content_url: string
      mapped_content_url: string
      content_type: string
      size: number
      width: number
      height: number
      inline: boolean
      deleted: boolean
      malware_access_override: boolean
      malware_scan_result: string
      thumbnails: any[],
    },
  }
}





export async function getAttachment(content_url: string) {
  const fi = (await axios.get(content_url, {
    responseType: 'arraybuffer',
    headers,
  })).data
  return fi || null
}


export async function getZendeskComments(id: number, domain: string): Promise<ZendeskComment[]> {


  let comments: ZendeskComment[] = []

  try {
    let response: ZendeskCommentsResponse = (await axios.get(`https://${domain}.zendesk.com/api/v2/tickets/${id}/comments.json`, { headers })).data || {}
    comments = response.comments || []
    while (response.next_page) {
      try {
        response = (await axios.get(response.next_page, { headers })).data || {}
      } catch (err) {
        debugger
      }
      if (response.comments) comments = [...comments, ...response.comments]
    }
  } catch (err) {
    debugger
  }

  return comments
}

export async function sendComment(id: number, body: string, audio: any, format: string, domain: string) {

  const tz = {
    ticket: {
      comment: {
        body,
      }
    }
  }

  try {
    if (audio) {
      const binaudio = Buffer.from(audio, 'base64')
      const uploadRespone = await axios.post(`https://${domain}.zendesk.com/api/v2/uploads?filename=tts${format}`, binaudio, {
        headers: {
          ...headers,
          "Content-Type": "audio/mpeg"
        }
      })
      const att = uploadRespone.data as UploadResponse
      tz.ticket.comment["uploads"] = [att.upload.token]
    }

    await axios.put(`https://${domain}.zendesk.com/api/v2/tickets/${id}.json`, tz, { headers })
  } catch (error) {
    debugger
  }

}



async function postComment(w: AgentWorker, a: Agent, payload: Payload) {
  const zendeskid = payload.zendeskid as number
  if (!zendeskid) return
  await sendComment(zendeskid, payload.output, a.audio, ".mp3", w.zendeskDomain)
}



async function getComments(w: AgentWorker, a: Agent, payload: Payload) {

  const zendeskid = payload.zendeskid as number
  if (!zendeskid || !w.zendeskDomain) return

  const comments = await getZendeskComments(zendeskid, w.zendeskDomain)
  let buffer: any
  let extension: string
  let message: string

  if (comments.length > 0) {
    const last = comments[comments.length - 1]

    try {
      if (last.attachments && last.attachments.length > 0) {
        const attachment = last.attachments[0]
        if (attachment && attachment.content_type.startsWith("audio")) {
          extension = path.extname(attachment.content_url)
          buffer = await getAttachment(attachment.content_url)
        }
      } else {
        const audioLinks = (last.html_body || "").match(audioLinkRegex)
        const fi = (await axios.get(audioLinks[0], { responseType: 'arraybuffer', })).data
        buffer = fi
        extension = path.extname(audioLinks[0])
      }
    } catch (err) {

    }

    if (buffer) {

      const stt = await audio.speechToText({
        provider: "whisper",
        audio: buffer,
        extension,
      })

      if (stt) message = stt

    }

    const allComments = comments.map((comment) => `Message: ${comment.body}`).join("\n\n")

    let zendeskContext = `

    Use this previous conversation as an additional context:
    <previous messages>
    ${allComments}
    </previous messages>
    
  `
    zendeskContext = zendeskContext.replace(fileLinkRegex, '')
    message = message.replace(fileLinkRegex, '')

    a.prompt = a.prompt + zendeskContext
    a.input = message

  }
}



async function execute(w: AgentWorker, a: Agent, payload: Payload) {

  if (w.zendeskAction == "getcomments") {
    await getComments(w, a, payload)
  } else if (w.zendeskAction == "sendmessage") {
    await postComment(w, a, payload)
  }

}


workers.zendesk = execute

