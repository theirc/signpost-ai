import OpenAI from "openai"
import axios from "axios"

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
  const inputValue = worker.fields.input.value
  
  if (!inputValue) return

  // Handle different input formats
  let audioFile: File | null = null
  let audioExt = 'mp3'
  
  // Check if it's already in the expected format { audio: base64, ext: string }
  if (inputValue && typeof inputValue === 'object' && 'audio' in inputValue && 'ext' in inputValue) {
    const audio = inputValue as { audio: string, ext: string }
    audioExt = (audio.ext || 'mp3') as string
    
    // Decode base64 to binary
    const binaryString = atob(audio.audio)
    const bytes = new Uint8Array(binaryString.length)
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i)
    }
    audioFile = new File([bytes], `audio.${audioExt}`, { type: `audio/${audioExt}` })
  } else if (typeof inputValue === 'string') {
    // If it's a URL string (from Content worker), fetch it directly
    if (inputValue.startsWith('http://') || inputValue.startsWith('https://') || inputValue.startsWith('data:')) {
      // Fetch the audio file using axios
      const response = await axios.get(inputValue, {
        responseType: 'arraybuffer'
      })
      
      // Determine extension from Content-Type header or URL
      const contentType = response.headers['content-type']
      if (contentType?.startsWith('audio/')) {
        const mimeMatch = contentType.match(/audio\/([^;]+)/)
        if (mimeMatch) {
          audioExt = mimeMatch[1].split('+')[0] // Handle audio/ogg; codecs=opus
        }
      } else if (inputValue.startsWith('data:')) {
        const dataMatch = inputValue.match(/data:audio\/([^;]+)/)
        if (dataMatch) audioExt = dataMatch[1]
      } else {
        // Fallback: extract from URL pathname
        try {
          const url = new URL(inputValue)
          const pathname = url.pathname
          const extMatch = pathname.match(/\.([^.]+)$/)
          if (extMatch) audioExt = extMatch[1]
        } catch {
          // Invalid URL, keep default mp3
        }
      }
      
      const bytes = new Uint8Array(response.data)
      audioFile = new File([bytes], `audio.${audioExt}`, { type: contentType || `audio/${audioExt}` })
    } else {
      throw new Error(`Invalid audio input format. Expected object with {audio, ext} or URL string`)
    }
  } else {
    throw new Error(`Invalid audio input format. Expected object with {audio, ext} or URL string`)
  }

  if (!audioFile) {
    throw new Error("Failed to create audio file")
  }

  const engine = worker.parameters.engine || "whisper-1"
  const openai = new OpenAI({ apiKey: apiKeys.openai, dangerouslyAllowBrowser: true })

  const response = await openai.audio.transcriptions.create({
    file: audioFile,
    model: engine,
  })

  worker.fields.output.value = response.text
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
