import { AgentInputItem, Agent as OpenAIAgent, run, tool, user } from '@openai/agents'
import { promptWithHandoffInstructions } from '@openai/agents-core/extensions'
import { aisdk } from '@openai/agents-extensions'
import { z } from 'zod'
import { createModel } from '../utils'

declare global {
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
      instructions: NodeIO
      handoff?: NodeIO
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
      console.log("🔨 context_change_tool", ctx)
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
  await run(extractAgent, history, { context, })
  console.log("Context Extract:", context)

  return context
}

async function execute(worker: PromptAgentWorker, p: AgentParameters) {

  worker.state.context ||= {}
  worker.state.history ||= []

  const { history } = worker.state
  const baseModel = createModel(p.apiKeys, worker.parameters.model ||= "openai/gpt-4.1")

  if (!baseModel) {
    worker.error = "No model selected"
    return
  }

  const model = aisdk(baseModel)
  const instructions = worker.fields.instructions.value
  const input = worker.fields.input.value
  const userHandlers = worker.getUserHandlers()

  history.push(user(input || ""))

  worker.state.context = (await contextExtractor(instructions, worker.state.context, model, userHandlers, history)) || {}
  for (const key in worker.state.context) {
    const field = userHandlers.find((h) => h.name === key)
    if (field) field.value = worker.state.context[key]
  }

  const handoffAgents = worker.getConnectedWokersToHandle(worker.fields.handoff, p).filter((w) => w.config.type === "handoffAgent") as any as HandoffAgentWorker[]
  const handoffs = []


  for (const handoffAgent of handoffAgents) {
    if (!handoffAgent.parameters.handoffDescription || !handoffAgent.parameters.model) continue
    const oldc = p.agent.currentWorker
    await worker.execute(p)
    p.agent.currentWorker = oldc
    if (!handoffAgent.fields.instructions) continue

    console.log(`Creating handoff agent: ${handoffAgent.parameters.handoffDescription} with instructions ${handoffAgent.fields.instructions.value}`)

    const baseModel = createModel(p.apiKeys, worker.parameters.model ||= "openai/gpt-4.1")
    const model = aisdk(baseModel)
    const hoa = new OpenAIAgent({
      name: 'Handoff Agent',
      model,
      handoffDescription: handoffAgent.parameters.handoffDescription,
      instructions: promptWithHandoffInstructions(handoffAgent.fields.instructions.value),
    })
    handoffs.push(hoa)
  }



  const agent = new OpenAIAgent({
    name: 'Agent',
    model,
    instructions,
    handoffs,
  })


  const result = await run(agent, history)

  worker.fields.output.value = result.finalOutput
  worker.state.history = result.history

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
        state: {
          context: {},
          history: [],
        }
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "string", direction: "output", title: "Output", name: "output" },
        { type: "string", direction: "input", title: "Instructions", name: "instructions" },
        { type: "handoff", direction: "output", title: "Handoffs", name: "handoff" },
      ],
      promptAgent
    )
  },
  get registry() { return promptAgent },
}
