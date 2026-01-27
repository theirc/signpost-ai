import { searchWeaviate } from "./weaviate"
import { searchExa } from "./exa"
import { searchJina } from "./jina"
import { searchServices, searchSupabase, searchSupabaseDomains } from "./supa"
import { databricks } from "./databricks"
import { searchYouTube } from "./youtube"
import { zendesk } from "./zendesk"
import { rescue } from "./rescue"

declare global {

  type VectorSearchEngines = "weaviate" | "supabase" | "supabased" | "exa" | "jina" | "databricks" | "youtube" | "zendesk" | "rescuenet" | "services"

  interface VectorSerach {
    type: VectorSearchEngines
    query: string
    limit?: number
    keys: APIKeys,
    locale?: string
    domain?: string
    distance?: number
    sources?: number[]
    chunked?: boolean
    url?: string
    team?: string
  }

}



export async function doVectorSearch(p: VectorSerach) {

  if (!p.query) return []
  p.query = p.query.trim()
  p.limit = p.limit || 5

  if (p.type == "weaviate") return searchWeaviate(p)
  if (p.type == "exa") return searchExa(p)
  if (p.type == "jina") return searchJina(p)
  if (p.type == "supabase") return searchSupabase(p)
  if (p.type == "supabased") return searchSupabaseDomains(p)
  if (p.type == "services") return searchServices(p)
  if (p.type == "databricks") return databricks.search(p)
  if (p.type == "youtube") return searchYouTube(p)
  if (p.type == "zendesk") return zendesk.search(p)
  if (p.type == "rescuenet") return rescue.search(p)

}

