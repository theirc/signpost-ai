declare global {
  type TTSEngine = "whisper"
  interface TTSWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
    parameters: {}
  }
}

async function detectLanguage(text: string, googleTranslateApiKey: string) {
  try {
    const url = `https://translation.googleapis.com/language/translate/v2/detect?key=${googleTranslateApiKey}`
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        q: text
      })
    })
    const data = await response.json()
    const detection = data.data.detections[0][0]
    console.log(`Detected language: ${detection.language}`)
    return detection.language
  } catch (error) {
    console.error('Error detecting language: ', error)
    return 'en'
  }
}

async function getAvailableVoices(googleApiKey: string) {
  try {
    const url = `https://texttospeech.googleapis.com/v1/voices?key=${googleApiKey}`
    const response = await fetch(url, {
      method: 'GET',
    })
    const responseJson = await response.json()
    return responseJson?.voices
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

async function googletextToSpeech(text: string, format: string, apikeys: APIKeys): Promise<string> {
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

    if (!apikeys.google || !text) return

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

    const response = await fetch(url, {
      method: 'POST',
      body: JSON.stringify(data)
    })

    const responseJson = await response.json()
    return responseJson?.audioContent

  } catch (error) {
    throw new Error(error)
  }

}

async function execute(worker: TTSWorker, { apiKeys }: AgentParameters) {

  const text = worker.fields.input.value

  const textToSpeech = await googletextToSpeech(text, "MP3", apiKeys)

  worker.fields.output.value = { audio: textToSpeech, ext: "mp3" }
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
