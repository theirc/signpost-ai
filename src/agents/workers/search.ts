import axios from "axios"

declare global {

  interface SearchWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
      references: NodeIO

      engine: NodeIO
      domain: NodeIO
      distance: NodeIO
      maxResults: NodeIO

      condition: NodeIO
    },
    parameters: {
      engine?: "weaviate" | "exa"
      maxResults?: number
      domain?: string
      distance?: number
    }
  }

  interface SearchParams {
    query: string
    domains?: string[]
    distance?: number
    limit?: number
    locales?: string[]
  }

  interface VectorDocument {
    ref?: string
    title: string
    body: string
    domain?: string
    source?: string
    locale?: string
    lat?: number
    lon?: number
  }
}

function deduplicateDocuments(array: VectorDocument[]): VectorDocument[] {
  const seen = {}
  const deduped: VectorDocument[] = []
  for (const d of array) {
    if (!seen[d.source]) {
      deduped.push(d)
      seen[d.source] = true
    }
  }
  return deduped
}

async function execute(worker: SearchWorker) {

  console.log("Executing search worker...")

  worker.fields.output.value = []
  worker.fields.references.value = []

  const query = worker.fields.input.value || ""
  const domains = worker.parameters.domain ? [worker.parameters.domain] : []
  const limit = worker.parameters.maxResults || 5

  const r = await axios.post("https://directus-qa-support.azurewebsites.net/search", {
    query,
    domains,
    limit,
    distance: worker.parameters.distance || 0.2,
  })

  const data = r.data as VectorDocument[] || []

  console.log("Search result: ", data)


  if (data.length === 0) return
  worker.fields.output.value = data

  const deduped = deduplicateDocuments(data)
  worker.fields.references.value = deduped.map(d => ({ link: d.ref || "", title: d.title || "" }))

}


export const search: WorkerRegistryItem = {
  title: "Search",
  execute,
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "search",
        parameters: {},
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "doc", direction: "output", title: "Documents", name: "output" },
        { type: "references", direction: "output", title: "References", name: "references" },

        { type: "string", direction: "input", title: "Engine", name: "engine" },
        { type: "string", direction: "input", title: "Domain", name: "domain" },
        { type: "number", direction: "input", title: "Distance", name: "distance" },
        { type: "number", direction: "input", title: "Max Results", name: "maxResults" },



        { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      ],
      search
    )
  },
  get registry() { return search },
}

