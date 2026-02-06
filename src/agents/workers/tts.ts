import OpenAI from "openai"
import axios from "axios"

declare global {
  type TTSEngine = "google" | "openai"
  interface TTSWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
    parameters: {
      engine?: TTSEngine
    }
  }
}

async function detectLanguage(text: string, googleTranslateApiKey: string) {
  try {
    const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${googleTranslateApiKey}`
    const response = await axios.post(url, {
      q: text
    }, {
      headers: {
        'Content-Type': 'application/json',
      }
    })
    const detection = response.data.data.detections[0][0]
    return detection.language
  } catch (error) {
    console.error('Error detecting language: ', error)
    return 'en'
  }
}

async function getAvailableVoices(googleApiKey: string) {
  try {
    const url = `https://texttospeech.googleapis.com/v1/voices?key=${googleApiKey}`
    const response = await axios.get(url)
    return response.data?.voices
  } catch (error) {
    console.error('Error fetching voices: ', error)
  }
}

async function findBestVoiceForLanguage(languageCode: string, voices: any[]): Promise<string> {
  const matchingVoices = voices.filter(voice => voice.languageCodes?.includes(languageCode))
  if (matchingVoices.length > 0) {
    return matchingVoices[0].languageCodes![0]
  }
  const generalLanguage = languageCode.split('-')[0]
  const fallbackVoices = voices.filter(voice => voice.languageCodes?.some(code => code.startsWith(generalLanguage)))
  if (fallbackVoices.length > 0) {
    return fallbackVoices[0].languageCodes![0]
  }
  return 'en-US'
}

async function googletextToSpeech(text: string, format: string, apikeys: APIKeys): Promise<{ audio: string, ext: string }> {
  try {
    const language = await detectLanguage(text, apikeys?.googleTranslate || "")
    const voices = await getAvailableVoices(apikeys?.google || "")
    const bestVoice = findBestVoiceForLanguage(language, voices)

    let voiceName = null

    if (language == "en" || language == "en-US") {
      voiceName = {
        "languageCode": "en-US",
        name: "en-US-Journey-O",
        ssmlGender: "FEMALE",
      }
    } else if (language == "es" || language == "es-ES") {
      voiceName = {
        "languageCode": "es-US",
        name: "es-US-Journey-F",
        ssmlGender: "FEMALE",
      }
    }

    if (!apikeys.google || !text) {
      throw new Error("Google API key or text is missing")
    }

    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${apikeys.google}`

    const data = {
      'input': {
        'text': text
      },
      'voice': voiceName || {
        'languageCode': bestVoice,
      },
      'audioConfig': {
        'audioEncoding': format
      }
    }

    const response = await axios.post(url, data, {
      headers: {
        'Content-Type': 'application/json',
      }
    })

    const audioContent = response.data?.audioContent

    // Determine file extension based on format
    let ext = "ogg"
    if (format === "MP3") {
      ext = "mpeg" // Use mpeg extension for audio/mpeg mime type
    } else if (format === "OGG_OPUS") {
      ext = "ogg"
    }

    return { audio: audioContent, ext }

  } catch (error) {
    throw new Error(`Google TTS error: ${error instanceof Error ? error.message : String(error)}`)
  }

}

async function openaiTextToSpeech(text: string, apikeys: APIKeys): Promise<{ audio: string, ext: string }> {
  try {
    if (!apikeys.openai || !text) {
      throw new Error("OpenAI API key or text is missing")
    }

    const openai = new OpenAI({ apiKey: apikeys.openai, dangerouslyAllowBrowser: true })

    // Use opus format for Telerivet compatibility (audio/ogg; codecs=opus)
    const response = await openai.audio.speech.create({
      model: "tts-1",
      input: text,
      voice: "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
      response_format: "opus", // Changed to opus for Telerivet compatibility
      speed: 1.0
    })

    // Convert the response to base64
    const arrayBuffer = await response.arrayBuffer()
    const bytes = new Uint8Array(arrayBuffer)
    let binary = ''
    for (let i = 0; i < bytes.length; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    const base64 = btoa(binary)

    return { audio: base64, ext: "ogg" } // opus format uses ogg container
  } catch (error) {
    throw new Error(`OpenAI TTS error: ${error instanceof Error ? error.message : String(error)}`)
  }
}

async function execute(worker: TTSWorker, { apiKeys }: AgentParameters) {
  const text = worker.fields.input.value
  const engine = worker.parameters.engine || "google" // Default to Google for backward compatibility

  let result: { audio: string, ext: string }

  if (engine === "openai") {
    result = await openaiTextToSpeech(text, apiKeys)
  } else {
    // Use OGG_OPUS format for Google TTS to ensure Telerivet compatibility
    result = await googletextToSpeech(text, "OGG_OPUS", apiKeys)
  }

  worker.fields.output.value = result
}


export const tts: WorkerRegistryItem = {
  title: "TTS",
  execute,
  category: "tool",
  type: "tts",
  description: "This worker converts text to speach",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      {
        type: "tts",
        conditionable: true,
        parameters: {
          engine: "google" as TTSEngine, // Initialize with default engine
        },
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "audio", direction: "output", title: "Output", name: "output" },
      ],
      tts
    ) as TTSWorker
    return w
  },
  get registry() { return tts },
}
