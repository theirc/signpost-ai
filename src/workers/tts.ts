import { audio } from "../audio"
import { workers } from "./workers"

async function execute(w: AgentWorker, a: Agent, payload: Payload) {

  if (!a.audio || !w.output) return

  const message = audio.speechToText({
    provider: w.ttsProvider || "whisper",
    audio: a.audio.content,
    extension: a.audio.extension,
  })

  if (message) payload[w.output] = message

}

workers.ai = execute