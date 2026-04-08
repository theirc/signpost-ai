
declare global {
  type ModelProviders = "openai" | "anthropic" | "google" | "groq"
}

const openAiModels = [
  'gpt-5.4',
  'gpt-5.4-pro',
  'gpt-5.4-mini',
  'gpt-5.4-nano',
  'gpt-5',
  'gpt-5-pro',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'o4-mini',
  'o3-pro',
  'o3',
  'o3-mini',
  'o1-pro',
  'o1',
  'o1-preview',
  'o1-mini',
]

const anthropicModels = [
  "claude-sonnet-4-5",
  "claude-haiku-4-5",
  "claude-opus-4-5"
]

const googleModels = [
  "gemini-2.5-pro",
  "gemini-2.5-flash",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
  "gemini-1.5-flash",
  "gemini-1.5-flash-8b",
  "gemini-1.5-pro",
]
const groqmodels = [
  "openai/gpt-oss-safeguard-20b",
]

export const OpenAIModels = openAiModels.map(model => ({
  value: `openai/${model}`,
  label: `OpenAI - ${model}`
}))

export const ClaudeModels = anthropicModels.map(model => ({
  value: `anthropic/${model}`,
  label: `Anthropic - ${model}`
}))

export const GoogleModels = googleModels.map(model => ({
  value: `google/${model}`,
  label: `Google - ${model}`
}))

export const GroqModels = groqmodels.map(model => ({
  value: `groq/${model}`,
  label: `Groq - ${model}`
}))

export const AllAIModels = [
  ...OpenAIModels,
  ...ClaudeModels,
  ...GoogleModels,
  ...GroqModels
]
