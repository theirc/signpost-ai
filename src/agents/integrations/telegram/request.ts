import axios from "axios"
import { baseUrl } from "./config"

// The bot token is part of the url, so it never travels in a header or a body.
export async function post(token: string, method: string, body: any) {
  const r = await axios.post(`${baseUrl}/bot${token}/${method}`, body, { headers: { "Content-Type": "application/json" } })
  return r.data?.result
}
