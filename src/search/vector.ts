import weaviate, { Collection, FilterValue, Filters, WeaviateClient, dataType, generative, vectorizer } from 'weaviate-client'
import { RecursiveCharacterTextSplitter } from './textsplitter'
import { converters } from './converters'
type VectorItemOrigins = "zd" | "service" | "external" | "solinum"
const collectionName = "Signpost"
const httpHost = process.env.WEAVIATE_HTTPHOST
const grpcHost = process.env.WEAVIATE_GRPCHOST

let initClient: WeaviateClient


interface VectorItem extends Doc {
  ref?: string
  origin: VectorItemOrigins
}

interface WeaviateResult {
  objects: {
    metadata: {
      creationTime?: string
      updateTime?: string
      distance?: number
      certainty?: number
      score?: number
      explainScore?: string
    },
    properties: {
      domain?: string
      country?: string
      ref?: string
      source?: string
      body?: string
      title?: string
      origin?: VectorItemOrigins
      lat?: number
      lon?: number
      linefrom?: number
      lineto?: number
    },
    uuid?: string
  }[]
}



async function connect(): Promise<WeaviateClient> {
  if (initClient) return initClient
  try {
    const client = await weaviate.connectToCustom({
      httpHost,
      httpSecure: false,
      skipInitChecks: true,
      httpPort: 80,
      grpcHost,
      headers: { 'X-OpenAI-Api-Key': process.env.OPENAI_API_KEY, }
    })
    initClient = client
    return client
  } catch (err) {
    debugger
  }
}

async function createCollection() {

  const client = await connect()

  await client.collections.create({
    name: collectionName,
    properties: [
      { name: 'body', dataType: dataType.TEXT },
      { name: 'title', dataType: dataType.TEXT },

      { name: 'origin', dataType: dataType.TEXT, skipVectorization: true, },
      { name: 'domain', dataType: dataType.TEXT, skipVectorization: true, },
      { name: 'country', dataType: dataType.TEXT, skipVectorization: true, },
      { name: 'ref', dataType: dataType.TEXT, skipVectorization: true, },
      { name: 'source', dataType: dataType.TEXT, skipVectorization: true, },

      { name: 'lat', dataType: dataType.NUMBER, skipVectorization: true, },
      { name: 'lon', dataType: dataType.NUMBER, skipVectorization: true, },

      { name: 'linefrom', dataType: dataType.NUMBER, skipVectorization: true, },
      { name: 'lineto', dataType: dataType.NUMBER, skipVectorization: true, },
    ],
    vectorizers: vectorizer.text2VecOpenAI(),
    generative: generative.openAI(),
  })

  console.log(`Collection created!`)

}

async function deleteCollections() {
  const client = await connect()
  await client.collections.deleteAll()
  console.log(`Collection Cleared!`)
}

async function getCollection(): Promise<Collection<VectorItem, "Signpost">> {
  const client = await connect()
  const myCollection = client.collections.get(collectionName)
  return myCollection as any
}

async function deleteAllDocumentsByRef(ref: string) {
  const col = await getCollection()
  await col.data.deleteMany(col.filter.byProperty('ref').equal(ref))
}

async function deleteAllDocumentsByOrigin(origin: VectorItemOrigins) {
  console.log(`Deleting all Documents for origin ${origin}...`)
  const col = await getCollection()
  const response = await col.data.deleteMany(col.filter.byProperty('origin').equal(origin))
  console.log(`Deleted ${response.matches} documents`)
}

async function deleteAllDocumentsByDomain(domain: string) {
  console.log(`Deleting all Documents for domain ${domain}...`)
  const col = await getCollection()
  const response = await col.data.deleteMany(col.filter.byProperty('domain').equal(domain))
  console.log(`Deleted ${response.matches} documents`)
}

async function getCount(filters: FilterValue) {
  let col = await getCollection()
  const total = (await col.aggregate.overAll({ filters })).totalCount
  return total
}

async function fetchReferences(filters: FilterValue) {

  let col = await getCollection()
  const total = (await col.aggregate.overAll({ filters })).totalCount

  const chunkSize = 1000
  const refs: { [index: string]: string } = {}
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = await col.query.fetchObjects({
      filters,
      limit: chunkSize,
      offset: i,
    })
    for (const obj of chunk.objects) {
      refs[obj.properties.ref] = obj.properties.ref
    }
  }
  return Object.values(refs)
}

async function fetchDocuments(filters: FilterValue) {

  let col = await getCollection()
  const total = (await col.aggregate.overAll({ filters })).totalCount

  const chunkSize = 1000
  const collection = await getCollection()
  const refs: { [index: string]: VectorItem } = {}
  for (let i = 0; i < total; i += chunkSize) {
    const chunk = await collection.query.fetchObjects({
      filters,
      limit: chunkSize,
      offset: i,
    })
    for (const obj of chunk.objects) {
      refs[obj.properties.ref] = obj.properties
    }
  }
  return Object.values(refs)
}

async function addArticles(art: VectorItem[]) {
  if (!art || art.length == 0) return
  const col = await getCollection()
  const m = await col.data.insertMany(art)
  return m
}

async function upsertArticle(id: string | number, art: VectorItem) {
  if (!art || !id || !art.body) return

  const pieces = RecursiveCharacterTextSplitter.fromLanguage("markdown").splitDocuments([art])
  let ref = `${id}`.trim()

  await deleteAllDocumentsByRef(ref)

  const vis: VectorItem[] = pieces.map(d => {
    return {
      ref,
      body: d.body,
      title: art.title,
      origin: art.origin,
      domain: art.domain,
      source: art.source,
      country: art.country,
      lat: art.lat,
      lon: art.lon,
      fromLine: d.fromLine || 0,
      toLine: d.toLine || 0,
    } satisfies VectorItem
  })

  await addArticles(vis)

}


async function search(p: SearchParams): Promise<Doc[]> {

  const docs: Doc[] = []

  if (!p.query) return docs

  p.domains = p.domains || []
  p.distance = p.distance || 0.4
  p.limit = p.limit || 4

  const col = await getCollection()

  let filterItems = [] as any

  if (p.domains.length > 0) filterItems.push(col.filter.byProperty('domain').containsAny(p.domains))

  let filters
  if (filterItems.length > 0) filters = Filters.or(...filterItems)

  const result: WeaviateResult = await col.query.nearText(p.query, {
    distance: p.distance,
    filters,
    returnMetadata: ['distance', 'certainty', 'score', 'creationTime', 'explainScore', 'isConsistent', 'score', 'updateTime'],
    limit: p.limit,
  }) as any

  for (const r of result.objects) {
    const d: VectorItem = {
      body: r.properties.body,
      id: Number(r.properties.ref) ? Number(r.properties.ref) : r.properties.ref as any,
      title: r.properties.title,
      source: r.properties.source,
      fromLine: r.properties.linefrom || 0,
      toLine: r.properties.lineto || 0,
      lat: r.properties.lat || 0,
      lon: r.properties.lon || 0,
      country: r.properties.country || "",
      domain: r.properties.domain || "",
      origin: r.properties.origin,
    }
    docs.push(d)
  }

  return docs

}

export const vector = {
  converters,
  deleteAllDocumentsByDomain,
  deleteAllDocumentsByRef,
  deleteAllDocumentsByOrigin,
  getCount,
  fetchDocuments,
  fetchReferences,
  upsertArticle,
  search,
}

