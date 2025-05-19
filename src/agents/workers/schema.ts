import { createJsonTranslator, createLanguageModel } from "typechat"
import { createTypeScriptJsonValidator } from "typechat/ts"


declare global {
  interface SchemaWorker extends AIWorker {
    fields: {
      input: NodeIO
      json: NodeIO
      condition: NodeIO
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
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      { type: "json", direction: "output", title: "JSON", name: "json", system: true },
    ],
    schema
  )

}

async function execute(worker: SchemaWorker, p: AgentParameters) {

  const handlers = worker.getUserHandlers()
  const input = worker.fields.input.value

  if (!input) return

  let schema = `
  
  export interface Schema {
  
  `

  for (let s of handlers) {
    let type = ""
    if (s.type == "boolean") {
      type = "boolean"
    } else if (s.type == "number") {
      type = "number"
    } else if (s.type == "string") {
      type = "string"
    } else if (s.type == "string[]") {
      type = "string[]"
    } else if (s.type == "number[]") {
      type = "number[]"
    } else if (s.type == "enum") {
      type = `${s.enum ? s.enum?.map((e) => `"${e}"`).join(" | ") : "string[]"}`
    } else {
      type = "any"
    }

    schema += `

    /*
    ${s.prompt}
    */
    ${s.name}?: ${type}

    `

  }

  schema += `
  
  }
  `

  const OPENAI_MODEL = worker.parameters.model || "gpt-4o"
  console.log("OPENAI_MODEL", OPENAI_MODEL)

  const schemaModel = createLanguageModel({
    OPENAI_MODEL,
    OPENAI_API_KEY: p.apikeys.openai,
  })

  const validator = createTypeScriptJsonValidator<any>(schema, "Schema")
  const translator = createJsonTranslator<any>(schemaModel, validator)
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

