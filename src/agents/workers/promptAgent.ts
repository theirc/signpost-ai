import { AgentInputItem, FunctionTool, Agent as OpenAIAgent, run, tool, user } from '@openai/agents'
import { aisdk } from '@openai/agents-extensions'
import { z } from 'zod'
import { createModel } from '../utils'

declare global {
  type HistoryMode = "none" | "full" | "sumarized"

  interface PromptAgentWorker extends AIWorker {
    state: {
      context: {}
      history: AgentInputItem[]
    }
    parameters: {
      model?: string
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

async function contextExtractor(instructions: string, context: any, model: any, userHandlers: NodeIO[], history: AgentInputItem[]) {
  if (userHandlers.length === 0) return context

  const schemaFields: Record<string, z.ZodTypeAny> = {}

  for (let s of userHandlers) {
    let fieldSchema: z.ZodTypeAny
    if (s.type == "boolean") {
      fieldSchema = z.boolean()
    } else if (s.type == "number") {
      fieldSchema = z.number()
    } else if (s.type == "string") {
      fieldSchema = z.string()
    } else if (s.type == "string[]") {
      fieldSchema = z.array(z.string())
    } else if (s.type == "number[]") {
      fieldSchema = z.array(z.number())
    } else if (s.type == "enum" && s.enum && s.enum.length > 0) {
      fieldSchema = z.enum(s.enum as [string, ...string[]])
    } else {
      fieldSchema = z.any()
    }
    // schemaFields[s.name] = fieldSchema.nullable().optional().default(null).describe(s.prompt || "")
    schemaFields[s.name] = fieldSchema.nullable().default(null)
  }

  const parameters = z.object(schemaFields)

  const contextTool = tool({
    name: 'context_gathering_tool',
    description: 'Always call this tool on each execution.',
    parameters,
    async execute(ctx) {
      if (ctx) context = ctx
      // console.log("🔨 context_change_tool", ctx)
      return ``
    },
  })

  const extractAgent = new OpenAIAgent({
    name: 'Agent Context Extractor',
    model,
    instructions: `
       **ALWAYS CALL THE TOOL "context_gathering_tool" ON EACH EXECUTION.**
      ${instructions}
      `,
    modelSettings: { toolChoice: 'required' },
    tools: [contextTool],
  })
  await run(extractAgent, [...history], { context, })
  console.log("Context Extract:", context)

  return context
}

async function execute(worker: PromptAgentWorker, p: AgentParameters) {

  const handoffAgents = worker.getConnectedWokersToHandle(worker.fields.handoff, p).filter((w) => w.config.type === "handoffAgent") as any as HandoffAgentWorker[]
  const baseModel = createModel(p.apiKeys, worker.parameters.model ||= "openai/gpt-4.1")

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
  const userHandlers = worker.getUserHandlers()

  history.push(user(input || ""))

  worker.state.context = (await contextExtractor(instructions, worker.state.context, model, userHandlers, history)) || {}
  for (const key in worker.state.context) {
    const field = userHandlers.find((h) => h.name === key)
    if (field && worker.state.context[key] != null) field.value = worker.state.context[key]
  }

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

  console.log("Result History:", result.history)

  const historyWorkers = worker.getConnectedWokersToHandle(worker.fields.history, p).filter((w) => w.config.type === "chatHistory") as any as ChatHistoryWorker[]
  const hw = historyWorkers[0]

  if (hw) {
    console.log("History Worker", hw)
    await hw.saveHistory(hw, p, result.history, searchContext)
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

// interface HistoryItem {
//   type?: "message" | "function_call" | "function_call_result" | "hosted_tool_call" | "computer_call" | "computer_call_result" | "reasoning" | "unknown"
//   role?: "user" | "assistant"
//   status?: "completed"
//   callId?: string
//   name?: string
//   arguments?: any
//   content?: {
//     type?: "input_text" | "output_text"
//     text?: string | object
//   }[]
// }
