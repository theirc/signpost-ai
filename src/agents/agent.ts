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
    googleTranslate?: string
    databricks?: string
  }

  interface AgentParameters {
    debug?: boolean
    input?: any
    uid?: string
    output?: any
    agent?: Agent
    error?: string
    apiKeys?: APIKeys
    team?: string
    session?: string
    state?: {
      agent: {}
      workers: { [key: string]: any }
    }
    logWriter?: (p: { worker: AIWorker, state: any }) => void
  }
}

export const agents = {
  createAgent,
  configureAgent,
  saveAgent,
  loadAgent,
}

