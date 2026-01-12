import axios from "axios"
import { format } from "date-fns"
import { ulid } from "ulid"

declare global {
  interface DatabricksTable {
    id?: string
    file_id?: string
    file_sk?: string
    page_id?: number
    file_type?: string
    box_url?: string
    box_path?: string //team
    dbx_path?: string
    size?: bigint //tokens
    modified_at?: any
    ingestion_timestamp?: any
    chunk_index?: number
    text?: string
  }

}

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

const endpoint = "https://adb-1480015211736579.19.azuredatabricks.net"
const warehouse_id = 'ef7435b84eed6a64'

async function sync({ token }: { token: string }) {

  const url = `${endpoint}/api/2.0/vector-search/indexes/irc_data_vectorization.documents__gold.signpost_docs_vector/sync`

  const bbody = {
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
  }

  try {
    await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", bbody)
  } catch (error) {
    debugger
  }

}

async function search(p: VectorSerach) {

  let results: VectorDocument[] = []

  const authToken = p.keys.databricks
  let index = p.domain

  if (!authToken) throw new Error("Databricks API key is required.")
  if (!index) throw new Error("Databricks index is required.")

  let filter = null

  if (index == "signpost") {
    index = "signpost_docs_vector" // Set the real index but include team filter
    filter = { "box_path": p.team }
  }

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

  if (filter) {
    body["filters_json"] = JSON.stringify(filter)
  }

  const rdata = await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)
  const r = rdata.data as DatabricksResponse

  r.result.data_array ||= []

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

async function load({ keys, team }: { keys: APIKeys, team: string }) {

  console.log(team)

  if (!keys.databricks) return []

  let results: DatabricksTable[] = []


  const url = `${endpoint}/api/2.0/sql/statements`

  const body = {
    url,
    headers: {
      Authorization: `Bearer ${keys.databricks}`,
    },
    on_wait_timeout: "CANCEL",
    // statement: "SELECT id,file_type,size,ingestion_timestamp,box_path FROM irc_data_vectorization.documents__gold.signpost_docs_chunks ORDER BY ingestion_timestamp DESC LIMIT 100",
    statement: `SELECT id,file_type,size,ingestion_timestamp,box_path FROM irc_data_vectorization.documents__gold.signpost_docs_chunks WHERE box_path = '${team}'  ORDER BY ingestion_timestamp DESC`,
    wait_timeout: "30s",
    warehouse_id
  }

  const rdata = await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)
  const r = rdata.data?.result?.data_array ?? [] as (any[])[]

  for (const row of r) {
    const [id, file_type, size, ingestion_timestamp, box_path] = row
    results.push({
      id,
      file_type,
      size,
      ingestion_timestamp: new Date(ingestion_timestamp),
      box_path,
    })
  }
  return results

}

async function find({ id, token }: { token: string, id: string }) {


  let results: DatabricksTable[] = []

  const url = `${endpoint}/api/2.0/sql/statements`

  const body = {
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    on_wait_timeout: "CANCEL",
    statement: `SELECT id,file_type,box_path,text FROM irc_data_vectorization.documents__gold.signpost_docs_chunks WHERE id = '${id}'`,
    wait_timeout: "30s",
    warehouse_id
  }

  const rdata = await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)
  const r = rdata.data?.result?.data_array ?? [] as (any[])[]

  for (const row of r) {
    const [id, file_type, box_path, text] = row
    results.push({
      id,
      file_type,
      text,
      box_path,
    })
  }
  return results[0] || null

}

interface AddContent {
  name: string
  token: string
  team: string
  content: string
  tokens: number
}

async function insert({ token, team, content, name, tokens }: AddContent) {

  if (!content) return

  const url = `${endpoint}/api/2.0/sql/statements`

  content = content.replace(/'/g, "''") //Important: escape single quotes for SQL
  const id = ulid()

  const body = {
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    warehouse_id,
    catalog: "irc_data_vectorization",
    schema: "documents__gold",
    statement: `INSERT INTO signpost_docs_chunks (id,file_type,box_path,text,size) VALUES ('${id}','${name}','${team}','${content}', ${tokens || 0})`,
    wait_timeout: "30s",
    on_wait_timeout: "CANCEL"
  }

  await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)

}

async function deleteItem({ token, id }: { token: string, id: string }) {

  if (!id) return
  const url = `${endpoint}/api/2.0/sql/statements`
  const body = {
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    warehouse_id,
    catalog: "irc_data_vectorization",
    schema: "documents__gold",
    statement: `DELETE FROM signpost_docs_chunks WHERE id = '${id}'`,
    wait_timeout: "30s",
    on_wait_timeout: "CANCEL"
  }

  await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)

}

async function update({ token, content, tokens, id }: { token: string, content: string, tokens: number, id: string }) {

  if (!content) return

  const url = `${endpoint}/api/2.0/sql/statements`

  content = content.replace(/'/g, "''") //Important: escape single quotes for SQL

  const body = {
    url,
    headers: {
      Authorization: `Bearer ${token}`,
    },
    warehouse_id,
    catalog: "irc_data_vectorization",
    schema: "documents__gold",
    statement: `UPDATE signpost_docs_chunks SET text = '${content}', size = ${tokens || 0} WHERE id = '${id}'`,
    wait_timeout: "30s",
    on_wait_timeout: "CANCEL"
  }

  await axios.post("https://signpost-ia-app-qa.azurewebsites.net/decors", body)

}




export const databricks = {
  search,
  load,
  find,
  insert,
  delete: deleteItem,
  sync,
  update,
}
