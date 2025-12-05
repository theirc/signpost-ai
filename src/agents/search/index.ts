import { searchWeaviate } from "./weaviate"
import { searchExa } from "./exa"
import { searchJina } from "./jina"
import { searchSupabase } from "./supa"
import { searchDatabricks } from "./databricks"

declare global {

  type VectorSearchEngines = "weaviate" | "supabase" | "exa" | "jina" | "databricks"

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
  }

}



export async function doVectorSearch(p: VectorSerach) {

  if (p.type == "weaviate") return searchWeaviate(p)
  if (p.type == "exa") return searchExa(p)
  if (p.type == "jina") return searchJina(p)
  if (p.type == "supabase") return searchSupabase(p)
  if (p.type == "databricks") return searchDatabricks(p)

}

