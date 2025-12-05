import axios from "axios"

interface DatabricksResponse {
  manifest: {
    column_count: number
    columns: {
      name: string
    }[]
  },
  result: {
    row_count: number
    data_array: [id: string, content: string, source: string, score: number][]
  },
  next_page_token: string
}

export async function searchDatabricks(p: VectorSerach) {

  let results: VectorDocument[] = []

  const authToken = p.keys.databricks
  const index = p.domain
  const endpoint = "https://adb-1480015211736579.19.azuredatabricks.net"

  if (!authToken) throw new Error("Databricks API key is required.")

  if (!index) throw new Error("Databricks index is required.")
  const url = `${endpoint}/api/2.0/vector-search/indexes/irc_data_vectorization.documents__gold.${index}/query`

  const body = {
    url,
    headers: {
      Authorization: `Bearer ${authToken}`,
    },
    columns: ["id", "text", "box_url"],
    num_results: p.limit || 5,
    query_type: "HYBRID",
    query_text: p.query
  }

  const rdata = await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)
  const r = rdata.data as DatabricksResponse

  for (const row of r.result.data_array) {
    const [id, body, source, score] = row
    results.push({
      source,
      body,
      title: source,
      origin: "databricks"
    })
  }

  return results

}