import { supabase } from "../../db"
import { processWhatsapp } from "./whatsapp"
import { processTelerivet } from "./telerivet"

export async function processChannel(channelId: string, payload: any) {

  if (!channelId) return

  const { data, error } = await supabase.from("channels").select("*").eq("id", channelId).single()
  if (error || !data) {
    console.error(`Channel not found: ${channelId}`)
    return
  }

  const channel = data as Channel

  switch (channel.type) {
    case "whatsapp":
      await processWhatsapp(channel, payload)
      break
    case "telerivet":
      await processTelerivet(channel, payload)
      break
    default:
      console.error(`Unsupported channel type: ${channel.type}`)
  }

}
