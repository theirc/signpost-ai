import { z } from "zod"
import { createModel } from "../utils"
import { CoreMessage, generateObject } from "ai"
import { AgentInputItem, UserMessageItem } from "@openai/agents"

const defaultInstructions = 'Extract the data from the input history according to the schema. If there is not matching data, use null for each field.'

declare global {
  interface StructuredOutputWorker extends AIWorker {
    fields: {
      input: NodeIO
      history: NodeIO
      JSON: NodeIO
    }
    parameters: {
      model?: string
      instructions?: string
    }
  }
}

function create(agent: Agent) {

  return agent.initializeWorker(
    {
      type: "structured",
      parameters: {
        model: "openai/gpt-4o",
        instructions: defaultInstructions,
      },
      conditionable: true,
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "chat", direction: "input", title: "History", name: "history" },
      { type: "json", direction: "output", title: "JSON", name: "JSON", system: true },
    ],
    structured
  )

}

async function execute(worker: StructuredOutputWorker, p: AgentParameters) {

  const handlers = worker.getUserHandlers()
  const input = worker.fields.input.value

  const schemaFields: Record<string, z.ZodTypeAny> = {}

  for (let s of handlers) {
    let fieldSchema: z.ZodTypeAny
    if (s.type == "boolean") {
      fieldSchema = z.boolean().nullable().default(null)
    } else if (s.type == "number") {
      fieldSchema = z.number().nullable().default(null)
    } else if (s.type == "string") {
      fieldSchema = z.string().nullable().default(null)
    } else if (s.type == "string[]") {
      fieldSchema = z.array(z.string()).nullable().default(null)
    } else if (s.type == "number[]") {
      fieldSchema = z.array(z.number()).nullable().default(null)
    } else if (s.type == "enum" && s.enum && s.enum.length > 0) {
      fieldSchema = z.enum(s.enum as [string, ...string[]]).nullable().default(null)
    } else {
      fieldSchema = z.any().nullable().default(null)
    }

    schemaFields[s.name] = fieldSchema.optional().describe(s.prompt || "")
  }

  const schema = z.object(schemaFields)
  const model = createModel(p.apiKeys, worker.parameters.model || "openai/gpt-4o")

  let history: UserMessageItem[] = worker.fields.history.value || []
  history = history.filter((h) => h.type == "message" && h.content)
  // history = history.filter((h) => !h.content)
  // history = history.filter((h) => h.type !== "message" && (h.role == "user" || h.role == "assistant") && h.content && h.content.length > 0)

  let messages: CoreMessage[] = []

  messages = history.map((m) => ({
    role: m.role,
    content: (m.content[0] as any || { text: "" }).text,
  })) as any

  messages = [
    {
      role: "system",
      content: worker.parameters.instructions || defaultInstructions,
    },
    ...messages,
    {
      role: "user",
      content: input,
    },
  ]


  const { object } = await generateObject({
    model,
    schema,
    messages,
  })

  const jsonout = {}
  if (object) {
    for (const key in object) {
      const h = handlers.find((h) => h.name == key)
      if (h) {
        worker.fields[h.name].value = object[key]
        if (worker.fields[h.name].value) {
          jsonout[h.name] = worker.fields[h.name].value
        }
      }
    }
  }

  worker.fields.JSON.value = jsonout

}


export const structured: WorkerRegistryItem = {
  title: "Structured",
  category: "generator",
  type: "structured",
  description: "This worker generates structured data based on a schema, input text, and optional chat history.",
  execute,
  create,
  get registry() { return structured },
}
