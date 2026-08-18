import axios from "axios"
import { baseUrl, platforms } from "./config"

// Meta doesn't include the contact name in the webhook, it has to be asked for by user id.
// Messenger answers with first_name/last_name, Instagram with name/username.
export async function getProfile(userId: string, page_token: string, fields: string = platforms.messenger.profileFields): Promise<string> {
  try {
    const url = `${baseUrl}/${userId}?fields=${encodeURIComponent(fields)}&access_token=${encodeURIComponent(page_token)}`
    const r = await axios.get(url)
    const d = r.data || {}
    return [d.first_name, d.last_name].filter(Boolean).join(" ") || d.name || d.username || ""
  } catch (err) {
    console.error(`Error getting meta profile: ${err}`)
    return ""
  }
}
