import { ai } from "../ai"
import { generateArticlesContext, generateTemplate, workers } from "./workers"

workers.documentselector = async (w: AgentWorker, a: Agent, payload: Payload) => {

  const schema =
    `
export interface SearchSchema {

  /*
  The input contains a list of articles surrounded by <articles>...</articles>, and each article has an id, a title and a content.

  ${generateTemplate(a, w.template, payload)}

  This is the list of the ids selected.
  */
  docs?: number[]

}

`

  const input = generateArticlesContext(a.documents)
  const result = await ai.schema(input, schema)

  if (result) {
    let docs = []
    for (const doc of result.data.docs) {
      result.push(docs[doc])
    }
    a.documents = docs
  }

}



