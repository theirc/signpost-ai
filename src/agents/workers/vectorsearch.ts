import { z } from "zod"
import { supabase } from "../db"
import { doVectorSearch } from "../search"

declare global {

  interface VectorSearchWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
      textOutput: NodeIO
      references: NodeIO
      tool: NodeIO
      source: NodeIO
      condition: NodeIO
    },
    parameters: {
      source?: string
      toolDescription?: string
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
    domain?: string[]
    source?: string
    locale?: string
    lat?: number
    lon?: number
    origin?: "supabase" | "exa" | "weaviate" | "jina" | "databricks" | "youtube" | "zendesk" | "rescuenet" | "services"
  }
}

function deduplicateLinks(array: VectorDocument[]): VectorDocument[] {
  const seen: Record<string, boolean> = {}
  const deduped: VectorDocument[] = []
  for (const d of array) {
    if (!seen[d.source]) {
      deduped.push(d)
      seen[d.source] = true
    }
  }
  return deduped
}

async function execute(worker: VectorSearchWorker, { apiKeys, team }: AgentParameters) {

  worker.fields.output.value = []
  worker.fields.references.value = []
  const source = worker.parameters.source || null

  const query = worker.fields.input.value || ""

  if (!query) {
    // When wired as a tool, the query arrives via the tool call — not via the
    // input edge. The flow traversal will run this node with no query before
    // the LLM has a chance to call the tool, so silently skip rather than error.
    const isToolOnly = !Object.values(worker.handles || {}).some(
      h => h.name === "input" && h.direction === "input" && (h.value ?? h.default)
    )
    if (isToolOnly) return
    worker.error = "Vector Search worker: No query provided."
    return
  }

  if (!source) {
    worker.error = "Vector Search worker: No Source provided."
    return
  }

  const { data, error } = await supabase.from("kbsources").select("*").eq("id", source).single()

  if (error) {
    worker.error = error.message
    return
  }

  if (!data) {
    worker.error = "Vector Search worker: Source not found."
    return
  }

  const sources: Source[] = data.sources as any

  if (!sources || sources.length == 0) {
    worker.error = "Vector Search worker: Sources not defined."
    return
  }


  let finalResults: VectorDocument[] = []

  for (const s of sources) {

    const r: VectorSerach = {
      type: s.type,
      query,
      limit: s.results,
      keys: apiKeys,
      distance: s.distance,
      locale: s.locale,
      domain: s.domain,
      chunked: s.chunked,
      sources: s.sources,
      url: s.url,
      team,
      baseUrl: s.baseUrl,
    }

    const docs = await doVectorSearch(r)
    finalResults = finalResults.concat(docs)

  }



  worker.fields.output.value = finalResults
  worker.fields.references.value = deduplicateLinks(finalResults).map(d => ({
    link: d.source || "",
    title: d.title || "Search Result",
    origin: d.origin
  }))

  worker.fields.textOutput.value = convertDocumentsToMarkdown(finalResults)  // Text format

}


function getTool(w: SearchWorker, p: AgentParameters): ToolConfig {
  const toolName = (w.parameters?.toolDescription || "search")
    .trim().toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "").slice(0, 64) || "search"

  const tool: ToolConfig = {
    name: toolName,
    description: w.parameters?.toolDescription,
    parameters: z.object({
      query: z.string().describe("The search query to execute."),
    }),

    async execute(args, ctx) {
      const { query } = args
      w.fields.input.value = query
      w.executed = true
      await vectorSearch.execute(w as any, p)
      const results = w.fields.output.value as VectorDocument[] || []
      const mddocs = convertDocumentsToMarkdown(results)
      ctx['searchResults'] = mddocs
      return mddocs
    },
  }

  return tool
}

export function convertDocumentsToMarkdown(docs: VectorDocument[]) {
  return `${docs.map((doc: VectorDocument) => {
    if (doc.origin != "supabase") return `Title: ${doc.title}\nContent: ${doc.body}\nLink: ${doc.source}`
    return `Title: ${doc.title}\nContent: ${doc.body}`
  }).join("\n\n")}`
}



export const vectorSearch: WorkerRegistryItem = {
  title: "Search 🧪",
  execute,
  category: "tool",
  type: "vectorSearch",
  description: "This worker allows you to search for information in knowledge bases",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      {
        type: "vectorSearch",
        parameters: {
          toolDescription: "Search tool",
        },
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "doc", direction: "output", title: "Documents", name: "output" },
        { type: "string", direction: "output", title: "Text Output", name: "textOutput" },
        { type: "references", direction: "output", title: "References", name: "references" },
        { type: "tool", direction: "input", title: "Tool", name: "tool" },
      ],
      vectorSearch
    )

    w.getTool = getTool

    return w
  },
  get registry() { return vectorSearch },
}

