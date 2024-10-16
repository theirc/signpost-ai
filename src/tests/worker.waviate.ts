
export const searchWeaviateTanzania: AgentWorker = {
  type: "search",
  input: "searchTerms",
  searchengine: "weaviate",
  searchLimit: 5,
  domains: [
    "signpost-tanzania"
  ]
}
