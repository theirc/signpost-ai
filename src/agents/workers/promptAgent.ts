import { AgentInputItem, FunctionTool, Agent as OpenAIAgent, run, tool, user, webSearchTool } from '@openai/agents'
import { aisdk } from '@openai/agents-extensions'
import { createModel } from '../utils'

declare global {
  type HistoryMode = "none" | "full" | "sumarized"

  interface AgentStateResponse {
    _context: {
      usage: {
        inputTokens: number
        outputTokens: number
      },
    }
  }

  interface PromptAgentWorker extends AIWorker {
    state: {
      context: {}
      history: AgentInputItem[]
    }
    parameters: {
      model?: string
      fallbackModel?: string
      searchTheWeb?: boolean
    }
    fields: {
      input: NodeIO
      output: NodeIO
      history: NodeIO
      instructions: NodeIO
      handoff?: NodeIO
      tool?: NodeIO
    }
  }
}

interface InvokeModelParams {
  modelId: string
  apiKeys: any
  instructions: string
  history: AgentInputItem[]
  handoffs: any[]
  tools: FunctionTool[]
  logAgent: { log: (data: any) => void }
}

interface InvokeModelResult {
  finalOutput: string
  history: AgentInputItem[]
  inputTokens: number
  outputTokens: number
  searchContext: string
}

async function invokeModel(params: InvokeModelParams): Promise<InvokeModelResult> {
  const { modelId, apiKeys, instructions, history, handoffs, tools, logAgent } = params

  const baseModel = createModel(apiKeys, modelId)
  if (!baseModel) throw new Error("Failed to create model")

  const model = aisdk(baseModel)

  const agent = new OpenAIAgent({
    name: 'Agent',
    model,
    instructions,
    handoffs,
    tools,
  })

  let searchContext = ""

  agent.on("agent_handoff", (ctx, agent) => {
    const message = `LLM Agent handoff to Agent with description '${agent.handoffDescription}'`
    logAgent.log({ type: "handoff", message, })
  })
  agent.on("agent_tool_start", (ctx, b) => {
    const message = `LLM Agent Tool '${b.name}' Start`
    logAgent.log({ type: "tool_start", message, })
  })
  agent.on("agent_tool_end", (ctx, b) => {
    const message = `LLM Agent Tool '${b.name}' End`
    logAgent.log({ type: "tool_end", message, })
    if (ctx['searchResults']) searchContext += `\n\nSearch Results for tool ${b.name}:\n${ctx['searchResults']}`
  })

  const result = await run(agent, history)

  let inputTokens = 0
  let outputTokens = 0
  const state: AgentStateResponse = result.state as any
  if (state && state._context && state._context.usage) {
    inputTokens = state._context.usage.inputTokens || 0
    outputTokens = state._context.usage.outputTokens || 0
  }

  return {
    finalOutput: result.finalOutput,
    history: result.history,
    inputTokens,
    outputTokens,
    searchContext,
  }
}


async function execute(worker: PromptAgentWorker, p: AgentParameters) {

  const handoffAgents = worker.getConnectedWokersToHandle(worker.fields.handoff, p).filter((w) => w.config.type === "handoffAgent") as any as HandoffAgentWorker[]
  const modelId = worker.parameters.model ||= "openai/gpt-4.1"
  const fallbackModelId = worker.parameters.fallbackModel
  const useSearch = worker.parameters.searchTheWeb || false

  const baseModel = createModel(p.apiKeys, modelId)
  if (!baseModel) {
    worker.error = "No model selected"
    return
  }

  for (const handoffAgent of handoffAgents) {
    if (!handoffAgent.parameters.model) {
      worker.error = `Model not set for Handoff Agent`
      return
    }
    if (!handoffAgent.parameters.handoffDescription) {
      worker.error = `Handoff Agent without handoff description found`
      return
    }
  }

  let history: AgentInputItem[] = worker.fields.history.value || []

  let instructions = worker.fields.instructions.value || ""
  const input = worker.fields.input.value

  const now = new Date()
  const dateOptions = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' }
  const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false }
  const formattedDate = now.toLocaleDateString("en-US", dateOptions as any)
  const formattedTime = now.toLocaleTimeString("en-US", timeOptions as any)

  instructions = `
  The current date is ${formattedDate} and the current time is ${formattedTime}.

  ${instructions}
  `

  history.push(user(input || ""))

  const handoffs = []
  for (const handoffAgent of handoffAgents) {
    const handoff = await handoffAgent.getHandoffAgent(handoffAgent, p)
    handoffs.push(handoff)
  }
  const agentTools = worker.getTools(worker, p)
  const tools: FunctionTool[] = agentTools.map(t => {
    return tool({
      name: t.description,
      description: t.description,
      parameters: t.parameters as any,
      execute: t.execute,
    })
  })

  if (useSearch) {
    tools.push(webSearchTool() as any)
  }

  const invokeParams: InvokeModelParams = {
    modelId,
    apiKeys: p.apiKeys,
    instructions,
    history,
    handoffs,
    tools,
    logAgent: p.agent,
  }

  let result: InvokeModelResult
  try {
    result = await invokeModel(invokeParams)
  } catch (error) {
    console.error("Primary model failed:", error)
    if (fallbackModelId) {
      try {
        result = await invokeModel({ ...invokeParams, modelId: fallbackModelId })
      } catch (fallbackError) {
        console.error("Fallback model also failed:", fallbackError)
        worker.error = `Both primary and fallback models failed: ${fallbackError}`
        return
      }
    } else {
      worker.error = `Model invocation failed: ${error}`
      return
    }
  }

  worker.inputTokens = result.inputTokens
  worker.outputTokens = result.outputTokens

  const historyWorkers = worker.getConnectedWokersToHandle(worker.fields.history, p).filter((w) => w.config.type === "chatHistory") as any as ChatHistoryWorker[]
  const hw = historyWorkers[0]

  if (hw) {
    await hw.saveHistory(hw, p, result.history, result.searchContext, worker.inputTokens, worker.outputTokens)
  }

  worker.fields.output.value = result.finalOutput

}

export const promptAgent: WorkerRegistryItem = {
  title: "LLM Agent",
  execute,
  category: "generator",
  type: "promptAgent",
  description: "Prompt based agent worker.",
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "promptAgent",
        conditionable: true,
        parameters: {
          model: "openai/gpt-4.1",
        },
        state: {}
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "string", direction: "output", title: "Output", name: "output" },
        { type: "string", direction: "input", title: "Instructions", name: "instructions" },
        { type: "chat", direction: "input", title: "History", name: "history" },
        { type: "handoff", direction: "output", title: "Handoffs", name: "handoff" },
        { type: "tool", direction: "output", title: "Tool", name: "tool" },
      ],
      promptAgent
    )
  },
  get registry() { return promptAgent },
}



