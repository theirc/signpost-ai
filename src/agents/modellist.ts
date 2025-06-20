type OpenAIChatModelId =
  'o1' |
  'o1-mini' |
  'o1-preview' |
  'o3-mini' |
  'gpt-4o' |
  'gpt-4o-mini' |
  'gpt-4-turbo' |
  'gpt-4' |
  'gpt-4.5-preview' |
  'gpt-3.5-turbo'

type AnthropicMessagesModelId =
  'claude-3-5-sonnet-latest' |
  'claude-3-5-haiku-latest' |
  'claude-3-opus-latest'


declare global {
  type ModelProviders = "openai" | "anthropic" | "google" | "deepseek" | "groq" | "xai"
}


export const OpenAIModels = [
  { value: "openai/o1", label: "OpenAi - o1" },
  { value: "openai/o1-mini", label: "OpenAI - o1-mini" },
  { value: "openai/o1-preview", label: "OpenAI - o1-preview" },
  { value: "openai/o3-mini", label: "OpenAI - o3-mini" },
  { value: "openai/gpt-4o", label: "OpenAI - gpt-4o" },
  { value: "openai/gpt-4o-mini", label: "OpenAI - gpt-4o-mini" },
  { value: "openai/gpt-4-turbo", label: "OpenAI - gpt-4-turbo" },
  { value: "openai/gpt-4", label: "OpenAI - gpt-4" },
  { value: "openai/gpt-4.5-preview", label: "OpenAI - gpt-4.5-preview " },
  { value: "openai/gpt-3.5-turbo", label: "OpenAI - gpt-3.5-turbo" },
]

export const ClaudeModels = [
  { value: "anthropic/claude-3-5-sonnet-latest", label: "Claude 3.5 Sonnet" },
  { value: "anthropic/claude-3-5-haiku-latest", label: "Claude 3.5 Haiku" },
  { value: "anthropic/claude-3-opus-latest", label: "Claude 3 Opus" },
]

export const AllAIModels = [
  ...OpenAIModels,
  ...ClaudeModels,
]

