import { francAll } from 'franc'


declare global {
  interface LanguageDetectionWorker extends AIWorker {
    fields: {
      input: NodeIO
      language: NodeIO
    }
    parameters: {
      languages: string[]
    }
  }
}

async function execute(worker: LanguageDetectionWorker, p: AgentParameters) {

  const input = worker.fields.input.value
  let language = "eng"

  const languages = worker.parameters.languages || []


  let detlangs = []

  if (languages.length > 0) {
    detlangs = francAll(input, { only: languages, minLength: 2 })
  } else {
    detlangs = francAll(input, { minLength: 2 })
  }

  if (detlangs && detlangs.length > 0) {
    language = detlangs[0]?.[0] || "eng"
  }


  worker.fields.language.value = language


}

function create(agent: Agent) {
  return agent.initializeWorker(
    {
      type: "languageDetection",
      parameters: {
        languages: [],
      },
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "string", direction: "output", title: "Language", name: "language" },
    ],
    languageDetection
  )
}

export const languageDetection: WorkerRegistryItem = {
  title: "Language Detection",
  category: "tool",
  type: "languageDetection",
  description: "Detects the language of the input text based on a list of ISO 639-3 language codes.",
  execute,
  create,
  get registry() { return languageDetection },
}
