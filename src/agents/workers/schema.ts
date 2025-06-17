import { createJsonTranslator, createLanguageModel } from "typechat"
import { createZodJsonValidator } from "typechat/zod"
import { z } from "zod"


declare global {
  interface SchemaWorker extends AIWorker {
    fields: {
      input: NodeIO
      json: NodeIO
      // condition: NodeIO
    }
    parameters: {
      model?: string
    }

  }
}

function create(agent: Agent) {

  return agent.initializeWorker(
    {
      type: "schema",
      parameters: {
        model: "gpt-4o",
      },
      conditionable: true,
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      // { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      { type: "json", direction: "output", title: "JSON", name: "json", system: true },
    ],
    schema
  )

}

async function execute(worker: SchemaWorker, p: AgentParameters) {

  const handlers = worker.getUserHandlers()
  const input = worker.fields.input.value

  if (!input) return

  const schemaFields: Record<string, z.ZodTypeAny> = {}

  for (let s of handlers) {
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

    schemaFields[s.name] = fieldSchema.optional().describe(s.prompt || "")
  }

  const schema = z.object(schemaFields)
  const OPENAI_MODEL = worker.parameters.model || "gpt-4o"
  const schemaModel = createLanguageModel({
    OPENAI_MODEL,
    OPENAI_API_KEY: p.apikeys.openai,
  })

  const dataExtractionSchema = {
    Response: schema
  }

  const validator = createZodJsonValidator(dataExtractionSchema, "Response")
  const translator = createJsonTranslator<z.infer<typeof schema>>(schemaModel, validator)
  const routeresponse = await translator.translate(input)

  const jsonout = {}

  if (routeresponse.success) {
    for (const key in routeresponse.data) {
      const h = handlers.find((h) => h.name == key)
      if (h) {
        worker.fields[h.name].value = routeresponse.data[key]
        if (worker.fields[h.name].value) {
          jsonout[h.name] = worker.fields[h.name].value
        }
      }
    }
  }

  worker.fields.json.value = jsonout


}


export const schema: WorkerRegistryItem = {
  title: "Schema",
  category: "generator",
  type: "schema",
  description: "This worker generates structured data based on a schema and the input.",
  execute,
  create,
  get registry() { return schema },
}
