import { AgentInputItem, FunctionTool, Agent as OpenAIAgent, run, tool, user } from '@openai/agents'
import { aisdk } from '@openai/agents-extensions'
import { z } from 'zod'
import { createModel } from '../utils'
import { supabase } from '../db'
import { Database, Tables } from '../supabase'
import { CoreMessage, generateText } from 'ai'

type HistoryItem = Partial<Database["public"]["Tables"]["history"]["Insert"]>

declare global {
  type HistoryMode = "none" | "full" | "sumarized"

  interface PromptAgentWorker extends AIWorker {
    state: {
      context: {}
      history: AgentInputItem[]
    }
    parameters: {
      model?: string
      history?: HistoryMode
      maxHistory?: number
      sumarizePrompt?: string
      sumarizationModel?: string
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

const sumarizePrompt = "Sumarize the chat history and keep the most important points of the conversation, return only the summary."


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

  const historyType = worker.parameters.history || "none"
  const maxHistory = worker.parameters.maxHistory || 100
  const sumarizationPrompt = worker.parameters.sumarizePrompt || sumarizePrompt
  let history: AgentInputItem[] = worker.fields.history.value
  let hasHistory = !history && p.uid && historyType != "none"

  worker.state.context ||= {}
  worker.state.history ||= []

  if (hasHistory) {
    const dbHistory = await supabase.from("history").select("*")
      .eq("uid", p.uid)
      .eq("agent", `${p.agent.id}`)
      .eq("worker", worker.id).order("id", { ascending: true })

    if (dbHistory.error) {
      console.log("DB Error", dbHistory.error)
      worker.error = dbHistory.error.toString()
      return
    }
    if (dbHistory.data) history = dbHistory.data.map((h) => {
      h.payload["__FROM_DB__"] = true
      return h.payload as any
    })
  }

  history ||= []
  const initialHistory = [...history]
  console.log("History", initialHistory)

  // const { history } = worker.state
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


  agent.on("agent_handoff", (ctx, agent) => {
    console.log(`👉 LLM Agent handoff to Agent with description '${agent.handoffDescription}'`)
  })
  agent.on("agent_tool_start", (ctx, b) => {
    console.log(`🔨 LLM Agent Tool '${b.name}' Start`, b, ctx)
  })
  agent.on("agent_tool_end", (ctx, b) => {
    console.log(`🔨 LLM Agent Tool '${b.name}' End`, b, ctx)
  })

  const result = await run(agent, history)

  console.log("Result History:", result.history)

  if (hasHistory) {

    let newItems = result.history.filter((h: any) => !h.__FROM_DB__)


    if (historyType === "sumarized" && maxHistory && result.history.length > maxHistory) {

      console.log("Summarizing History")

      const model = createModel(p.apiKeys, worker.parameters.sumarizationModel ||= "openai/gpt-4-turbo")
      let messages = result.history.filter((h: AgentInputItem) => h.type == "message").map((h: AgentInputItem) => {
        if (h.type == "message") return { role: h.role, content: (h.content[0] as any)?.text } satisfies CoreMessage
      })

      messages = [{
        role: "system",
        content: sumarizationPrompt
      }, ...messages]

      const { text } = await generateText({
        model,
        temperature: 0,
        messages,
      })

      newItems = [{ type: "message", role: "system", content: [{ type: "text", text }] }] as any
      await supabase.from("history").delete().eq("uid", p.uid)
      console.log("Summarized History", text)

    }

    for (const item of newItems) {
      await supabase.from("history").insert({
        uid: p.uid,
        agent: `${p.agent.id}`,
        worker: worker.id,
        arguments: (item as any).arguments,
        content: (item as any).content,
        name: (item as any).name,
        role: (item as any).role,
        status: (item as any).status,
        type: item.type,
        payload: item
      } satisfies HistoryItem)
    }

  }

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
          sumarizePrompt,
          history: "none",
          maxHistory: 100,
          sumarizationModel: "openai/gpt-4-turbo",
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
