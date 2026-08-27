import axios from "axios"
import { baseUrl } from "./config"
import type { MessengerCredentials } from "./types"

// Messenger authenticates the page with an access_token in the query string, not a bearer header.
export async function post({ page_id, page_token }: MessengerCredentials, body: any) {
  const url = `${baseUrl}/${page_id}/messages?access_token=${encodeURIComponent(page_token)}`
  const r = await axios.post(url, body, { headers: { "Content-Type": "application/json" } })
  return r.data
}
