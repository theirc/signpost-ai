import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createGroq } from '@ai-sdk/groq'


/** Throws if there is no API key for the model's provider. */
export function assertModelKey(apiKeys: APIKeys | null | undefined, modelName: string) {
  const provider = (modelName || "").split("/")[0]
  if (!provider) throw new Error(`"${modelName}" is not a valid model id.`)
  if (!apiKeys?.[provider]) {
    throw new Error(`No ${provider} API key found — add one in Settings > API Keys.`)
  }
}

export function createModel(apiKeys: APIKeys, modelName: string) {
  modelName = modelName || ""

  const [provider, ...modelarray] = modelName.split("/")
  const modelID = modelarray.join("/")

  if (!provider || !modelID) return null

  const apiKey = apiKeys[provider]

  if (!apiKey) {
    throw new Error(`No ${provider} API key found`)
  }

  let model: any = null

  if (provider === "openai") {
    // Reasoning models (gpt-5*/o*) reject function tools on /v1/chat/completions;
    // they need the responses API instead.
    const isReasoningModel = modelID.startsWith("gpt-5") || modelID.startsWith("o")
    const openai = createOpenAI({ apiKey })
    model = isReasoningModel ? openai.responses(modelID) : openai(modelID)
  } else if (provider === "anthropic") {
    model = createAnthropic({
      apiKey,
      headers: { 'anthropic-dangerous-direct-browser-access': 'true' }
    })(modelID)
  } else if (provider === "google") {
    model = createGoogleGenerativeAI({ apiKey })(modelID)
  } else if (provider === "groq") {
    model = createGroq({ apiKey })(modelID)
  }

  return model
}

export function convertDocumentsToMarkdown(docs: VectorDocument[]) {
  return `${docs.map((doc: VectorDocument) => `Title: ${doc.title}\nContent: ${doc.body}\nLink: ${doc.source}`).join("\n\n")}`
}
