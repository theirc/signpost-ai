import OpenAI, { toFile } from "openai"

interface SpeechToTextRequest {
  provider: "whisper"
  audio: any
  extension: string
}

interface TextToSpeechRequest {
  provider: "whisper"
  text: any
  extension: string
}

const openai = new OpenAI()

async function whisperSTT(r: SpeechToTextRequest) {
  const file = await toFile(Buffer.from(r.audio), `audio.${r.extension}`)
  const response = await openai.audio.transcriptions.create({ file, model: "whisper-1" })
  return response.text
}

async function speechToText(r: SpeechToTextRequest): Promise<string> {
  if (!r.audio) return
  if (r.provider == "whisper") {
    return await whisperSTT(r)
  }
}

async function textToSpech(r: TextToSpeechRequest) {
  //ToDo:
}

export const audio = {
  speechToText,
  textToSpech,
}