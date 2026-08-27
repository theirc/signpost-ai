import axios from "axios"
import { baseUrl } from "./config"
import { post } from "./request"
import type { TelegramFile } from "./types"

// Telegram has no public urls: a file_id is resolved with getFile and then downloaded from a url that
// embeds the bot token. That url never leaves this module so the token can't leak into a prompt or a log.
export async function downloadFile(token: string, fileId: string): Promise<{ bytes: Uint8Array, ext: string } | null> {
  try {
    const file: TelegramFile = await post(token, "getFile", { file_id: fileId })
    if (!file?.file_path) return null

    const r = await axios.get(`${baseUrl}/file/bot${token}/${file.file_path}`, { responseType: "arraybuffer" })
    const ext = (file.file_path.split(".").pop() || "").toLowerCase()

    return { bytes: new Uint8Array(r.data), ext: ext === "oga" ? "ogg" : ext }
  } catch (err) {
    console.error(`Error downloading telegram file: ${err}`)
    return null
  }
}
