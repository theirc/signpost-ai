import { buildChannel } from "./runner"
import { processWhatsapp } from "./whatsapp"
import { processTelerivet } from "./telerivet"
import { messengerChannel } from "./messenger"
import { instagramChannel } from "./instagram"
import { telegramChannel } from "./telegram"

type ChannelProcessor = (channel: Channel, payload: any) => Promise<void>

// Whatsapp and Telerivet predate the adapter contract and already implement this signature, so they enter as they are.
export const channelRegistry: { [type: string]: ChannelProcessor } = {
  whatsapp: processWhatsapp,
  telerivet: processTelerivet,
  messenger: buildChannel(messengerChannel),
  instagram: buildChannel(instagramChannel),
  telegram: buildChannel(telegramChannel),
}
