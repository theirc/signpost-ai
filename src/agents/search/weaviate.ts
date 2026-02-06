import axios from "axios"
import { deduplicateSources } from "./deduper"

export async function searchWeaviate(p: VectorSerach) {

  interface WeaviateVectorDocument {
    ref?: string
    title: string
    body: string
    domain?: string[]
    source?: string
    locale?: string
    lat?: number
    lon?: number
  }


  const { query, domain, limit, distance } = p

  let results: VectorDocument[] = []

  if (!domain) {
    console.warn("Weaviate: No domain provided.")
    return results
  }

  try {
    const externalSearchUrl = "https://directus-qa-support.azurewebsites.net/search"
    // const externalSearchUrl = "http://localhost:3000/search"
    const r = await axios.post(externalSearchUrl, {
      query,
      domains: [domain],
      limit: limit || 5,
      distance: distance || 0.5,
    })
    const wResutls: WeaviateVectorDocument[] = r.data || []

    results = wResutls.map((d) => ({
      ref: d.source,
      title: d.title,
      body: d.body,
      domain: d.domain,
      source: d.source,
      locale: d.locale,
      lat: d.lat,
      lon: d.lon,
      origin: "weaviate",
    }))

  } catch (error) {
    console.error("Error:", error.toString())
    throw error
  }

  return results

}
