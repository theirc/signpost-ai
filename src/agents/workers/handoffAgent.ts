import { FunctionTool, tool, Agent as OpenAIAgent } from "@openai/agents"
import { promptWithHandoffInstructions } from '@openai/agents-core/extensions'
import { z } from "zod"
import { createModel } from "../utils"
import { aisdk } from "@openai/agents-extensions"

declare global {
  interface HandoffAgentWorker extends AIWorker {
    parameters: {
      handoffDescription?: string
      model?: string
    }
    fields: {
      instructions?: NodeIO
      handoff?: NodeIO
      tool?: NodeIO
    }
    state: {
      context: any
      history: FunctionTool[]
    }
    getHandoffAgent?(worker: HandoffAgentWorker, p: AgentParameters): Promise<OpenAIAgent>
  }
}

async function execute(worker: HandoffAgentWorker, p: AgentParameters) {
  //nada
}

function getTools(worker: HandoffAgentWorker, p: AgentParameters): FunctionTool[] {

  const connected = worker.getConnectedWokersToHandle(worker.fields.tool, p)
  const tools: FunctionTool[] = []

  for (const c of connected) {
    const { description, parameters, execute } = c.getTool(c, p)
    if (!description) throw new Error(`Worker does not have a Tool Description parameter set. Please set it to describe the tool's purpose.`)
    const searchTool = tool({
      description,
      parameters,
      execute,
    })
    tools.push(searchTool)
  }
  return tools
}


async function getHandoffAgent(worker: HandoffAgentWorker, p: AgentParameters): Promise<OpenAIAgent> {

  await worker.execute(p)
  const baseModel = createModel(p.apiKeys, worker.parameters.model ||= "openai/gpt-4.1")
  const model = aisdk(baseModel)
  const handoffDescription = worker.parameters.handoffDescription
  const instructions = promptWithHandoffInstructions(worker.fields.instructions.value)

  const agentTools = worker.getTools(worker, p)

  const tools: FunctionTool[] = agentTools.map(t => {
    return tool({
      description: t.description,
      parameters: t.parameters,
      execute: t.execute,
    })
  })

  const hoa = new OpenAIAgent({
    name: 'Handoff Agent',
    model,
    handoffDescription,
    instructions,
    tools,
  })

  hoa.on("agent_handoff", (ctx, agent) => {
    console.log(`👉 LLM Agent handoff to Agent with description '${agent.handoffDescription}'`)
  })
  hoa.on("agent_tool_start", (ctx, b) => {
    console.log(`🔨 LLM Agent Tool '${b.name}' Start`, b, ctx)
  })
  hoa.on("agent_tool_end", (ctx, b) => {
    console.log(`🔨 LLM Agent Tool '${b.name}' End`, b, ctx)
  })

  return hoa
}

export const handoffAgent: WorkerRegistryItem = {
  title: "Handoff",
  execute,
  category: "generator",
  type: "handoffAgent",
  description: "Specialized agent worker for handling handoffs and routing.",
  create(agent: Agent) {

    const neww: HandoffAgentWorker = agent.initializeWorker(
      {
        type: "handoffAgent",
        conditionable: true,
        parameters: {
          model: "openai/gpt-4.1",
        },
        state: {
          context: {},
          history: [],
        },
      },
      [
        { type: "string", direction: "input", title: "Instructions", name: "instructions" },
        { type: "handoff", direction: "input", title: "Handoffs", name: "handoff" },
        { type: "tool", direction: "output", title: "Tool", name: "tool" },
      ],
      handoffAgent
    ) as any

    neww.getHandoffAgent = getHandoffAgent
    return neww

  },
  get registry() { return handoffAgent },
}
