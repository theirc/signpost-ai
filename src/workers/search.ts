import { searchExa } from "../search/exa"
import { vector } from "../search/vector"
import { workers } from "./workers"

async function execute(w: AgentWorker, a: Agent, payload: Payload) {

  if (!w.domains || w.domains.length == 0 || !w.input) return
  const query = payload[w.input]
  if (!query) return

  let docs: Doc[] = []

  const p: SearchParams = {
    query,
    limit: w.searchLimit || 10,
    distance: w.searchDistance || 0.5,
    domains: w.domains,
  }

  if (w.searchengine == "weaviate") {
    docs = await vector.search(p)
  } else if (w.searchengine == "exa") {
    docs = await searchExa(p)
  }

  a.documents = [...a.documents, ...docs]

}

workers.search = execute

