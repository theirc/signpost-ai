import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGroq } from '@ai-sdk/groq'
import { createXai } from '@ai-sdk/xai'
import { CoreMessage, generateText } from 'ai'

declare global {

  type ChatHistory = {
    role: "user" | "assistant"
    content: string
  }[]

  interface BotWorker extends AIWorker {
    fields: {
      prompt: NodeIO
      input: NodeIO
      documents: NodeIO
      history: NodeIO
      answer: NodeIO
      // condition: NodeIO
    }
    parameters: {
      temperature?: number
      model?: string
    }
  }
}

function create(agent: Agent) {

  return agent.initializeWorker(
    {
      type: "ai",
      conditionable: true,
      parameters: {
        temperature: 0,
      }
    },
    [
      { type: "string", direction: "input", title: "Prompt", name: "prompt" },
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "doc", direction: "input", title: "Documents", name: "documents" },
      { type: "chat", direction: "input", title: "History", name: "history" },
      { type: "string", direction: "output", title: "Answer", name: "answer" },
    ],
    ai,
  )
}


async function execute(worker: BotWorker, { apiKeys }: AgentParameters) {

  let model: any = null
  const paramModel = worker.parameters.model || ""

  const selModel = paramModel.split("/")
  const provider: ModelProviders = (selModel[0] as ModelProviders) || "openai"
  const modelID = selModel[1]

  if (!provider || !modelID) {
    worker.error = "No model selected"
    return
  }

  const apiKey = apiKeys[provider]

  if (!apiKey) {
    worker.error = `No ${provider} API key found`
    return
  }

  if (provider === "openai") {
    model = createOpenAI({ apiKey })(modelID)
  } else if (provider === "anthropic") {
    model = createAnthropic({ apiKey })(modelID)
  } else if (provider === "google") {
    model = createGoogleGenerativeAI({ apiKey })(modelID)
  } else if (provider === "deepseek") {
    model = createDeepSeek({ apiKey })(modelID)
  } else if (provider === "groq") {
    model = createGroq({ apiKey })(modelID)
  } else if (provider === "xai") {
    model = createXai({ apiKey })(modelID)
  }
  const messages: CoreMessage[] = []

  let prompt = worker.fields.prompt.value || ""
  messages.push({ role: "system", content: prompt })

  if (worker.fields.documents.value) {
    const docs = worker.fields.documents.value as VectorDocument[]
    let context = `Based on the following context 
    <Context>
    ${docs.map((doc: VectorDocument) => `Title: ${doc.title}\nContent: ${doc.body}\nLink: ${doc.source}`).join("\n\n")}
    </Context>
    Answer the question
    `
    messages.push({ role: "system", content: context })
  }

  if (worker.fields.history.value && worker.fields.history.value.length > 0) {
    const history = worker.fields.history.value as ChatHistory
    messages.push(...history.map((h) => ({ role: h.role, content: h.content })))
  }

  messages.push({ role: "user", content: worker.fields.input.value || "" })

  const { text } = await generateText({
    model,
    temperature: worker.parameters.temperature || 0,
    messages,
  })

  worker.fields.answer.value = text

}


export const ai: WorkerRegistryItem = {
  title: "AI",
  category: "generator",
  type: "ai",
  description: "This worker allows you to generate text using AI based on a prompt",
  execute,
  create,
  get registry() { return ai },
}

