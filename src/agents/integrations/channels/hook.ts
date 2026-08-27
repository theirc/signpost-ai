import { supabase } from "../../db"
import { channelRegistry } from "./registry"

export async function processChannel(channelId: string, payload: any) {

  if (!channelId) return

  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()
  if (error || !data) {
    console.error(`Channel not found: ${channelId}`)
    return
  }

  const channel = data as Channel

  const process = channelRegistry[channel.type]
  if (!process) {
    console.error(`Unsupported channel type: ${channel.type}`)
    return
  }

  await process(channel, payload)

}
