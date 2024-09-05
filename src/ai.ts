import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { Content, GoogleGenerativeAI } from "@google/generative-ai"
import { MessageParam } from "@anthropic-ai/sdk/resources/messages.mjs"

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const openai = new OpenAI({})
const ollama = new OpenAI({ baseURL: `${process.env.OLLAMA_HOST}/v1/` })
const anthropic = new Anthropic({})

interface CompletionRequest {
  provider: Providers
  model: string
  prompt?: string
  history?: ChatHistoryItem[]
  temperature?: number
}


function dedupeHistory(history: ChatHistoryItem[] = []): ChatHistoryItem[] {

  const finalhistory: ChatHistoryItem[] = []
  let last: ChatHistoryItem = null

  for (const h of history) {
    if (!last) {
      last = h
      finalhistory.push(h)
      continue
    }

    if (last.role === h.role) {
      last.content = last.content + "\n\n" + h.content + "\n\n"
      continue
    }
    last = h
    finalhistory.push(h)
  }

  return finalhistory
}

async function askOpenAI(r: CompletionRequest): Promise<BotReponse> {

  let messages: ChatCompletionMessageParam[] = [...r.history] as any

  const chatCompletion = await openai.chat.completions.create({
    temperature: r.temperature || 0,
    messages,
    model: r.model,
  })

  const response: BotReponse = {
    answer: chatCompletion?.choices[0]?.message?.content || "",
  }

  return response


}

async function askOllama(r: CompletionRequest): Promise<BotReponse> {

  let messages: ChatCompletionMessageParam[] = [...r.history] as any

  const chatCompletion = await ollama.chat.completions.create({
    temperature: r.temperature || 0,
    messages,
    model: r.model,
  })

  const response: BotReponse = {
    answer: chatCompletion?.choices[0]?.message?.content || "",
  }

  return response
}

async function askGemini(r: CompletionRequest): Promise<BotReponse> {

  const model = gemini.getGenerativeModel({ model: r.model })

  const contents: Content[] = r.history.map((h) => {
    return {
      role: h.role == "assistant" ? "model" : "user",
      parts: [{ text: h.content }]
    }
  })

  const answer = await model.generateContent({
    contents,
    generationConfig: {
      temperature: r.temperature || 0,
    },
  })

  const response: BotReponse = {
    answer: answer.response.text() || ""
  }

  return response
}

async function askClaude(r: CompletionRequest): Promise<BotReponse> {

  const messages: MessageParam[] = [{ role: "user", content: "Follow this instructions:" }, ...r.history as any]

  const message = await anthropic.messages.create({
    max_tokens: 1024,
    temperature: r.temperature || 0,
    messages,
    model: r.model,
  })
  const response: BotReponse = {
    answer: (message.content[0] as any)?.text || ""
  }
  return response
}


async function request(r: CompletionRequest): Promise<BotReponse> {

  r.history = dedupeHistory(r.history)

  if (r.provider == "openai") {
    return askOpenAI(r)
  } else if (r.provider == "ollama") {
    return askOllama(r)
  } else if (r.provider == "gemini") {
    return askGemini(r)
  } else if (r.provider == "claude") {
    return askClaude(r)
  }

}

export const ai = {
  request,
}

