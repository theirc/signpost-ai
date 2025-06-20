import { createOpenAI } from '@ai-sdk/openai'
import { createAnthropic } from '@ai-sdk/anthropic'
import { createGoogleGenerativeAI } from '@ai-sdk/google'
import { createDeepSeek } from '@ai-sdk/deepseek'
import { createGroq } from '@ai-sdk/groq'
import { createXai } from '@ai-sdk/xai'


export function createModel(apiKeys: APIKeys, modelName: string) {
  modelName = modelName || ""

  const selModel = modelName.split("/")
  const provider: ModelProviders = (selModel[0] as ModelProviders)
  const modelID = selModel[1]

  if (!provider || !modelID) return null

  const apiKey = apiKeys[provider]

  if (!apiKey) {
    throw new Error(`No ${provider} API key found`)
  }

  let model: any = null

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

  return model
}