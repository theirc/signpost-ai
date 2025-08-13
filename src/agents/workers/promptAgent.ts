import { AgentInputItem, FunctionTool, Agent as OpenAIAgent, run, tool, user, webSearchTool } from '@openai/agents'
import { aisdk } from '@openai/agents-extensions'
import { z } from 'zod'
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


async function execute(worker: PromptAgentWorker, p: AgentParameters) {

  const handoffAgents = worker.getConnectedWokersToHandle(worker.fields.handoff, p).filter((w) => w.config.type === "handoffAgent") as any as HandoffAgentWorker[]
  const baseModel = createModel(p.apiKeys, worker.parameters.model ||= "openai/gpt-4.1")
  const useSearch = worker.parameters.searchTheWeb || false


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

  const model = aisdk(baseModel)
  const instructions = worker.fields.instructions.value
  const input = worker.fields.input.value

  history.push(user(input || ""))

  const handoffs = []
  for (const handoffAgent of handoffAgents) {
    const handoff = await handoffAgent.getHandoffAgent(handoffAgent, p)
    handoffs.push(handoff)
  }
  const agentTools = worker.getTools(worker, p)
  const tools: FunctionTool[] = agentTools.map(t => {
    return tool({
      description: t.description,
      parameters: t.parameters,
      execute: t.execute,
    })
  })

  if (useSearch) {
    tools.push(webSearchTool() as any)
  }

  const agent = new OpenAIAgent({
    name: 'Agent',
    model,
    instructions,
    handoffs,
    tools,
  })

  let searchContext = ""

  agent.on("agent_handoff", (ctx, agent) => {
    console.log(`👉 LLM Agent handoff to Agent with description '${agent.handoffDescription}'`)
  })
  agent.on("agent_tool_start", (ctx, b) => {
    console.log(`🔨 LLM Agent Tool '${b.name}' Start`, b, ctx)
  })
  agent.on("agent_tool_end", (ctx, b) => {
    if (ctx['searchResults']) searchContext += `\n\nSearch Results for tool ${b.name}:\n${ctx['searchResults']}`
    console.log(`🔨 LLM Agent Tool '${b.name}' End`, b, ctx)
  })

  const result = await run(agent, history)
  console.log("Agent State:", result.state)

  let inputTokens = 0
  let outputTokens = 0
  const state: AgentStateResponse = result.state as any
  if (state && state._context && state._context.usage) {
    inputTokens = state._context.usage.inputTokens || 0
    outputTokens = state._context.usage.outputTokens || 0
  }

  console.log("Result History:", result.history)

  const historyWorkers = worker.getConnectedWokersToHandle(worker.fields.history, p).filter((w) => w.config.type === "chatHistory") as any as ChatHistoryWorker[]
  const hw = historyWorkers[0]

  if (hw) {
    console.log("History Worker", hw)
    await hw.saveHistory(hw, p, result.history, searchContext, inputTokens, outputTokens)
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



