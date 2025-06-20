import axios from "axios"

declare global {

  interface TranslateWorker extends AIWorker {
    fields: {
      input: NodeIO
      language: NodeIO
      output: NodeIO
    }
  }

}


async function execute(worker: TranslateWorker, { apiKeys }: AgentParameters) {

  const apiKey = apiKeys["googleTranslateApiKey"]
  const project = apiKeys["googleTranslateProjectId"]
  const targetLanguageCode = worker.fields.language.value || ""
  const content = worker.fields.input.value || ""

  if (!apiKey) {
    worker.error = `No Google Translate API key found`
    return
  }
  if (!project) {
    worker.error = `No Google Translate Project ID found`
    return
  }

  const r = await axios.post(`https://translation.googleapis.com/v3/projects/${project}:translateText`, {
    targetLanguageCode,
    contents: [content]
  }, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
      charset: "utf-8",
    },
  })

  worker.fields.output.value = r.data?.translations[0].translatedText || content

}


export const translate: WorkerRegistryItem = {
  title: "Translate",
  category: "tool",
  type: "translate",
  description: "Translate text using Google Translate API",
  execute,
  create(agent) {
    return agent.initializeWorker(
      {
        type: "translate",
        conditionable: true,
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "string", direction: "output", title: "Output", name: "output" },
        { type: "string", direction: "input", title: "Language", name: "language" },
        { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      ],
      translate,
    )
  },
  get registry() { return translate },

}

