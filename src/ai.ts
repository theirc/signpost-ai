import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { GoogleGenerativeAI } from "@google/generative-ai"

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const openai = new OpenAI({})
const ollama = new OpenAI({ baseURL: "http://57.152.89.100:11434/v1/" })
const anthropic = new Anthropic({})

interface CompletionRequest {
  provider: Providers
  model: string
  message: string
  context?: string
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
      last.content += h.content
      continue
    }
    finalhistory.push(h)
  }

  return finalhistory
}

async function askOpenAI(r: CompletionRequest): Promise<BotReponse> {

  let messages: ChatCompletionMessageParam[] = [
    { role: 'system', content: r.prompt },
  ]

  if (r.context) {
    messages.push({
      role: 'user', content: `
      Use this context for the conversation: 
      <Context> 
      ${r.context}
      </Context>`
    })
  }

  messages.push({ role: 'user', content: `${r.message}` })

  const chatCompletion = await openai.chat.completions.create({
    temperature: r.temperature || 0,
    messages,
    model: r.model,
  })

  console.log(chatCompletion)

  const response: BotReponse = {
    answer: chatCompletion.choices[0].message.content
  }

  return response


}

async function askOllama(r: CompletionRequest): Promise<BotReponse> {


  return null
}

async function askGemini(r: CompletionRequest): Promise<BotReponse> {
  // const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  return null
}
async function askClaude(r: CompletionRequest): Promise<BotReponse> {


  // let textHistory = ""
  // const messages: Anthropic.Messages.MessageParam[] = [{
  //   role: 'user', content: "why the sky is blue?",
  // }
  // ]

  // const message = await anthropic.messages.create({
  //   max_tokens: 1024,
  //   messages,
  //   model: 'claude-3-opus-20240229',
  // })
  // console.log(message)

  return null
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

