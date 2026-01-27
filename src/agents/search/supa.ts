import { supabase } from "../db"
import { domainToId, domainToUrl } from "./countries"
import { documents } from "./documents"

export async function searchSupabase(p: VectorSerach) {

  const { query, limit, keys } = p
  let results: VectorDocument[] = []

  const embedding = await documents.createEmbedding(query, keys.openai)

  const { data, error } = await supabase.rpc('match_vectors', {
    query_embedding: embedding as any,      // number[]
    match_count: limit,
    filter_is_chunk: p.chunked || false,           // or true/false
    filter_locale: p.locale || null,             // 'en', etc.
    // filter_status: null,             // e.g., 200
    filter_ids: p.sources || null,           // int[] or null
    // origin_lon: null,                // number or null
    // origin_lat: null,                // number or null
    // max_distance_meters: null,       // number or null
    // bbox_min_lon: null,              // number or null
    // bbox_min_lat: null,              // number or null
    // bbox_max_lon: null,              // number or null
    // bbox_max_lat: null,              // number or null
    // similarity: 'l2',                // or 'cosine'
    // similarity: 'cosine',                // or 'cosine'
  })

  results = data.map((item) => {
    const v: VectorDocument = {
      body: item.content,
      title: item.name,
      source: `/docu/supa/${item.id}`,
      locale: item.locale,
      ref: `${item.id}`,
      origin: "supabase",
    }
    return v
  })

  console.log(data)

  return results
}

export async function searchSupabaseDomains(p: VectorSerach) {

  const { query, limit, keys } = p
  let results: VectorDocument[] = []

  const embedding = await documents.createEmbedding(query, keys.openai)

  const { data, error } = await supabase.rpc('match_vectors_domains', {
    query_embedding: embedding as any,      // number[]
    match_count: limit,
    filter_is_chunk: p.chunked || false,           // or true/false
    filter_domains: p.sources || null,           // int[] or null
  })

  results = data.map((item) => {
    const v: VectorDocument = {
      body: item.content,
      title: item.name,
      source: `/docu/supa/${item.id}`,
      locale: item.locale,
      ref: `${item.id}`,
      origin: "supabase",
    }
    return v
  })

  console.log(data)

  return results
}

export async function searchServices(p: VectorSerach) {

  const { query, limit, keys } = p
  let results: VectorDocument[] = []

  const embedding = await documents.createEmbedding(query, keys.openai)
  const url = domainToUrl[p.domain || ""] || ""

  const { data, error } = await supabase.rpc('match_vectors_services', {
    query_embedding: embedding as any,
    match_count: limit,
    filter_is_chunk: false,
    filter_locale: p.domain || null,
    filter_ids: p.sources || null,
  })

  results = data.map((item) => {
    const v: VectorDocument = {
      body: item.content,
      title: item.name,
      source: `${url}/services/${item.external_id}`,
      locale: item.locale,
      ref: `${item.id}`,
      origin: "services",
    }
    return v
  })

  console.log(data)

  return results
}
