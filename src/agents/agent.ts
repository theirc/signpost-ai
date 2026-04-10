import { createAgent, configureAgent, loadAgent, saveAgent, forkAgent, mergeAgentIntoOriginal } from "./agentfactory"


declare global {

  type LiteralUnion<KnownValues extends string> = (string & {}) | KnownValues
  type Agent = ReturnType<typeof createAgent>
  type EdgeConnections = { [index: string]: { source: string, target: string, sourceHandle: string, targetHandle: string } }

  type IntegrationsTypes = "telerivet" | "app"

  interface IntegrationPayload {
    contact?: string //cross channel unique user id. If empty is created based on the integration data, usually the phone.
    type?: IntegrationsTypes
    name?: string
    phone?: string

    //Telerivet
    apiKey?: string
    projectId?: string
    route_id?: string
  }

  interface AgentState {
    agent: {
      hitl?: {
        active?: boolean
        causes?: string[]
      }
    }
    workers: { [key: string]: any }
  }

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
    exa?: string
    jina?: string
    youtube?: string
    rescuenet?: string
    telerivet?: string
    codec?: string
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
    integration?: IntegrationPayload
    state?: AgentState
    logWriter?: (p: { worker: AIWorker, state: any }) => void
    commandExecuted?: "reset"
    /** Resolves when the async eval + flag pipeline finishes. Set by agentfactory after execute(). */
    evalPromise?: Promise<void>
  }
}

export const agents = {
  createAgent,
  configureAgent,
  saveAgent,
  loadAgent,
  forkAgent,
  mergeAgentIntoOriginal,
}

