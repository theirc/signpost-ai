import { processChannel } from "./hook"
// import { app } from "./app"
import { channelRegistry } from "./registry"
import { processRouter } from "./router"
import { verifyChallenge, verifySignature } from "./meta-verify"

export const channels = {
  processChannel,
  channelRegistry,
  // app,
  processRouter,
  verifyChallenge,
  verifySignature,
}
