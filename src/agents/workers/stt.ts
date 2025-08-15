import OpenAI from "openai"

declare global {
  type STTEngine = "whisper-1"
  interface STTWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
    parameters: {
      engine?: STTEngine
    }
  }
}

async function execute(worker: STTWorker, { apiKeys }: AgentParameters) {
  const audio = worker.fields.input.value as { audio: string, ext: string }
  const engine = worker.parameters.engine || "whisper-1"
  const openai = new OpenAI({ apiKey: apiKeys.openai, dangerouslyAllowBrowser: true })

  const binaryString = atob(audio.audio)
  const bytes = new Uint8Array(binaryString.length)
  for (let i = 0; i < binaryString.length; i++) {
    bytes[i] = binaryString.charCodeAt(i)
  }
  const file = new File([bytes], `audio.${audio.ext}`, { type: `audio/${audio.ext}` })

  const response = await openai.audio.transcriptions.create({
    file,
    model: engine,
  })

  const message = response.text

  worker.fields.output.value = message
}


export const stt: WorkerRegistryItem = {
  title: "STT",
  execute,
  category: "tool",
  type: "stt",
  description: "This worker converts speach to text",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      {
        type: "stt",
        conditionable: true,
      },
      [
        { type: "audio", direction: "input", title: "Input", name: "input" },
        { type: "string", direction: "output", title: "Output", name: "output" },
      ],
      stt
    ) as STTWorker
    w.parameters.engine = "whisper-1"
    return w
  },
  get registry() { return stt },
}
