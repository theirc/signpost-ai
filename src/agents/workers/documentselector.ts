import { createJsonTranslator, createLanguageModel } from "typechat"
import { createTypeScriptJsonValidator } from "typechat/ts"
import { createZodJsonValidator } from "typechat/zod"
import { z } from "zod"

declare global {
  interface DocumentSelectorWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
      prompt: NodeIO
      documents: NodeIO
    },
    parameters: {
      results?: number
    }

  }
}

async function execute(worker: DocumentSelectorWorker, p: AgentParameters) {

  let question = worker.fields.input.value
  const results = worker.parameters.results || 8
  const documents = worker.fields.documents.value || []
  const prompt = worker.fields.prompt.value || ""
  const searchResults = []

  worker.fields.output.value = searchResults

  if (!question || !documents || documents.length === 0) return

  let context = documents.map((doc: VectorDocument, id) => `
id:${id} 
Title: ${doc.title || ""}
Content: ${doc.body || ""}
`).join("")

  const schema =
    `
  The input contains a context surrounded by <context>...</context>.
  The context contains a list of articles with an id, a title and a content.
  After the context, there is a question surrounded by <question>...</question>.
  Use the question to search the context to pick and prioritize the ${results} most relevant article's id using the following criteria:
  ${prompt}
`

  question = `
<context>
${context}
</context>

<question>
${question}
</question>
`
  const schemaModel = createLanguageModel({
    OPENAI_MODEL: "gpt-4o",
    OPENAI_API_KEY: p.apikeys.openai,
  })

  const documentsResponse = z.object({
    articles: z.number().array().describe(schema)
  })

  const documentSelectorSchema = {
    Response: documentsResponse
  }


  const validator = createZodJsonValidator(documentSelectorSchema, "Response")
  const translator = createJsonTranslator(schemaModel, validator)

  const response = await translator.translate(question)

  if (response.success) {
    response.data.articles ||= []
    console.log(response.data)
    response.data.articles ||= []
    for (const doc of response.data.articles) {
      searchResults.push(documents[doc])
    }
  } else {
    const error = (response as any).error
    console.error("Error: ", error)
    worker.error = error
  }

}

export const documentSelector: WorkerRegistryItem = {
  title: "Selector",
  execute,
  category: "tool",
  type: "documentSelector",
  description: "This worker select Documents based on a prompt.",
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "documentSelector",
        conditionable: true,
        parameters: {
          results: 8,
        },
      },
      [
        { type: "doc", direction: "input", title: "Documents", name: "documents" },
        { type: "doc", direction: "output", title: "Output", name: "output" },
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "string", direction: "input", title: "Prompt", name: "prompt" },
      ],
      documentSelector
    )

  },
  get registry() { return documentSelector },
}

