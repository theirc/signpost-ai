import OpenAI from "openai"
import Anthropic from "@anthropic-ai/sdk"
import { ChatCompletionMessageParam } from "openai/resources/chat/completions"
import { Content, GoogleGenerativeAI } from "@google/generative-ai"
import { MessageParam } from "@anthropic-ai/sdk/resources/messages.mjs"
import { createTypeScriptJsonValidator } from "typechat/ts"
import { createJsonTranslator, createLanguageModel } from "typechat"

const gemini = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY)
const openai = new OpenAI({})
const ollama = new OpenAI({ baseURL: `${process.env.OLLAMA_HOST}/v1/` })
const anthropic = new Anthropic({})

export const schemaModel = createLanguageModel({
  OPENAI_MODEL: "gpt-4o",
  OPENAI_API_KEY: process.env.OPENAI_API_KEY,
})

interface CompletionRequest {
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

async function schema(input: string, schema: string): Promise<any> {
  const validator = createTypeScriptJsonValidator<any>(schema, "Schema")
  const translator = createJsonTranslator<any>(schemaModel, validator)
  const routeresponse = await translator.translate(input)
  if (routeresponse.success) return routeresponse.data
  return null
}


/*

Available Models:

openai/gpt-4o
openai/gpt-4o-mini
openai/gpt-3.5-turbo

gemini/gemini-1.5-flash
gemini/gemini-1.5-pro
gemini/gemini-1.0-pro

anthropic/claude-3-5-sonnet-20240620
anthropic/claude-3-opus-20240229
anthropic/claude-3-sonnet-20240229
anthropic/claude-3-haiku-20240307

ollama/llama3
ollama/gemma
ollama/mistral
ollama/phi3
ollama/qwen

*/


async function request(r: CompletionRequest): Promise<BotReponse> {

  r.history = dedupeHistory(r.history)

  let { model } = r

  if (model.startsWith("openai/")) {
    model = model.replace("openai/", "")
    return askOpenAI({ ...r, model })
  } else if (model.startsWith("gemini/")) {
    model = model.replace("gemini/", "")
    return askGemini({ ...r, model })
  } else if (model.startsWith("anthropic/")) {
    model = model.replace("anthropic/", "")
    return askClaude({ ...r, model })
  } else if (model.startsWith("ollama/")) {
    model = model.replace("ollama/", "")
    return askOllama({ ...r, model })
  }

}

export const ai = {
  request,
  schema,
}

