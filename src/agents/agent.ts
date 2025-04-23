import { createAgent, configureAgent, loadAgent, saveAgent } from "./agentfactory"

declare global {
  type LiteralUnion<KnownValues extends string> = (string & {}) | KnownValues
  type Agent = ReturnType<typeof createAgent>
  type EdgeConnections = { [index: string]: { source: string, target: string, sourceHandle: string, targetHandle: string } }

  interface APIKeys {
    openai?: string
    anthropic?: string
    google?: string
    deepseek?: string
    groq?: string
    xai?: string
    zendesk?: string
  }

  interface AgentParameters {
    debug?: boolean
    input: any
    output?: any
    agent?: Agent
    error?: string
    apikeys?: APIKeys
  }
}

export const agents = {
  createAgent,
  configureAgent,
  saveAgent,
  loadAgent,
}

