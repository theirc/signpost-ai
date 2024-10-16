import { workers } from "./workers"
import { ai } from "../ai"

async function execute(w: AgentWorker, a: Agent, payload: Payload) {
  if (!w.schemas || !w.input) return

  const input = payload[w.input]
  if (!input) return

  let schema = `
  
  export interface Schema {
  
  `
  for (let s of w.schemas) {
    let type = ""
    if (s.type == "flag") {
      type = "boolean"
    } else if (s.type == "number") {
      type = "number"
    } else if (s.type == "text") {
      type = "string"
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

  const result = await ai.schema(input, schema)
  Object.assign(payload, result || {})

}

workers.schema = execute


