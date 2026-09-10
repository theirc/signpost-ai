import { processChannel } from "./hook"
import { channelRegistry } from "./registry"
import { processRouter } from "./router"
import { verifyChallenge, verifySignature } from "./meta-verify"

export const channels = {
  processChannel,
  channelRegistry,
  processRouter,
  verifyChallenge,
  verifySignature,
}
