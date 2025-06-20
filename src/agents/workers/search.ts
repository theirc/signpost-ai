import axios from "axios"
import { supabase } from "../db"


/**
 * Generates an embedding vector for a text string using OpenAI API
 *
 * @param {string} text - The text to generate an embedding for
 * @returns {Promise<{ data: number[] | null, error: Error | null }>} The embedding vector or null/error
 */
async function generateEmbedding(text: string, apiKeys: APIKeys): Promise<{
  data: number[] | null,
  error: Error | null
}> {
  try {
    console.log('[Worker Embedding] Starting OpenAI embedding generation...')

    const openaiApiKey = apiKeys.openai
    if (!openaiApiKey) {
      const errorMsg = 'Missing OpenAI API key. Please set OPENAI_API_KEY environment variable.'
      console.error(`[Worker Embedding] ${errorMsg}`)
      return { data: null, error: new Error(errorMsg) }
    }
    const input = text.replace(/\n/g, ' ') // OpenAI recommendation

    const response = await fetch('https://api.openai.com/v1/embeddings', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiApiKey}`
      },
      body: JSON.stringify({
        model: 'text-embedding-ada-002',
        input
      })
    })

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({ // Catch potential JSON parsing errors
        error: { message: `HTTP error ${response.status} - ${response.statusText}` }
      }))
      console.error('[Worker Embedding] OpenAI API error response:', errorData)
      throw new Error(`OpenAI API error: ${errorData.error?.message || 'Unknown error'}`)
    }

    const data = await response.json()

    if (!data.data || !data.data[0] || !data.data[0].embedding) {
      throw new Error('Invalid response structure from OpenAI API.')
    }

    const embedding = data.data[0].embedding
    console.log('[Worker Embedding] OpenAI embedding generated successfully.')

    // Verify the embedding size
    if (embedding.length !== 1536) {
      throw new Error(`Expected embedding dimension of 1536, but got ${embedding.length}`)
    }

    return { data: embedding, error: null }
  } catch (error) {
    console.error('[Worker Embedding] Error generating OpenAI embedding:', error)
    let errorMessage = 'Unknown error occurred during OpenAI embedding generation.'

    if (error instanceof Error) {
      errorMessage = error.message // Use the specific error message
    }

    return {
      data: null,
      error: new Error(errorMessage) // Ensure an Error object is returned
    }
  }
}

// =============================================
// ORIGINAL WORKER CODE (Modified)
// =============================================

declare global {

  interface SearchWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
      references: NodeIO

      engine: NodeIO
      domain: NodeIO
      distance: NodeIO
      maxResults: NodeIO
      collections: NodeIO

      condition: NodeIO
    },
    parameters: {
      engine?: "weaviate" | "exa" | "supabase"
      maxResults?: number
      domain?: string[]
      distance?: number
      collections?: string[]
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
  }
}

function deduplicateDocuments(array: VectorDocument[]): VectorDocument[] {
  const seen: Record<string, boolean> = {}
  const deduped: VectorDocument[] = []
  for (const d of array) {
    const key = `${d.source || 'unknown'}-${d.ref || d.title || 'untitled'}`
    if (!seen[key]) {
      deduped.push(d)
      seen[key] = true
    }
  }
  return deduped
}

async function execute(worker: SearchWorker, { apiKeys }: AgentParameters) {
  console.log("Executing search worker with parameters:", worker.parameters)

  worker.fields.output.value = []
  worker.fields.references.value = []

  const query = worker.fields.input.value || ""
  if (!query) {
    console.log("Search worker: No query provided.")
    return
  }

  const engine = worker.parameters.engine || "weaviate" // Default to an external engine
  let finalResults: VectorDocument[] = []
  let deduped: VectorDocument[] = []

  // --- Engine-Specific Search Logic --- 

  if (engine === 'supabase') {
    // --- Supabase Search Path --- 
    const collectionIds = Array.isArray(worker.parameters.collections)
      ? worker.parameters.collections
      : typeof worker.parameters.collections === 'string'
        ? [worker.parameters.collections]
        : []

    const limit = worker.parameters.maxResults || 5
    const similarityThreshold = worker.parameters.distance ?? 0.3

    if (collectionIds && collectionIds.length > 0) {
      console.log(`[Supabase Path] Searching ${collectionIds.length} collections:`, collectionIds)
      try {
        const { data: queryEmbedding, error: embeddingError } = await generateEmbedding(query, apiKeys)
        if (embeddingError || !queryEmbedding) {
          throw embeddingError || new Error("Failed to generate query embedding.")
        }

        console.log(`[Supabase Path] Generated query embedding (length: ${queryEmbedding.length}).`)

        const searchPromises = collectionIds.map(async (collectionId) => {
          console.log(`  - Searching collection: ${collectionId} (Limit: ${limit}, Threshold: ${similarityThreshold})`)
          try {
            const { data: supabaseMatches, error: rpcError } = await supabase.rpc('similarity_search', {
              query_vector: queryEmbedding as any,
              target_collection_id: collectionId,
              match_threshold: similarityThreshold,
              match_count: limit
            })
            if (rpcError) throw rpcError

            return (supabaseMatches || []).map((match: any) => {
              const sim = match.similarity !== null && match.similarity !== undefined ? match.similarity.toFixed(3) : 'N/A'
              const title = `${match.name || `[DB] ${match.source_type || 'unknown'}:${(match.id || 'no-id').substring(0, 8)}`} (Sim: ${sim})`
              return {
                ref: `supabase:${match.source_type || 'unknown'}:${match.id || 'no-id'}`,
                title: title,
                body: match.content || '',
                source: `supabase_collection:${collectionId}`,
              }
            })
          } catch (error) {
            console.error(`  - Error searching collection ${collectionId}:`, error)
            return []
          }
        })

        const resultsFromAllCollections = await Promise.all(searchPromises)
        finalResults = resultsFromAllCollections.flat()
        console.log(`[Supabase Path] Total results: ${finalResults.length}`)

      } catch (error) {
        console.error("[Supabase Path] Error during search process:", error)
        finalResults = []
      }
    } else {
      console.log("[Supabase Path] No collection IDs provided.")
      finalResults = []
    }

  } else {
    // --- External Engine Search Path (Weaviate, Exa, etc.) --- 
    const domain = Array.isArray(worker.parameters.domain) ? worker.parameters.domain : [worker.parameters.domain]
    const limit = worker.parameters.maxResults || 5
    const externalSearchDistance = worker.parameters.distance ?? 0.5 // Use distance, default 0.5

    if (domain) {
      console.log(`[External Path] Searching engine '${engine}' in domain: ${domain} (Limit: ${limit}, Distance: ${externalSearchDistance})`)
      try {
        const externalSearchUrl = "https://directus-qa-support.azurewebsites.net/search" // Assuming this URL handles different engines or we need logic here
        const r = await axios.post(externalSearchUrl, {
          query,
          domains: domain, // Pass domain in array
          limit,
          distance: externalSearchDistance,
          // We might need to pass the 'engine' type to the backend if it handles multiple engines
          // engine: engine, 
        })
        finalResults = r.data as VectorDocument[] || [] // Assign directly
        console.log(`[External Path] Total results: ${finalResults.length}`)
      } catch (error) {
        console.error("[External Path] Error during search:", error)
        finalResults = [] // Ensure empty results on error
      }
    } else {
      console.log("[External Path] No domain provided.")
      finalResults = []
    }
  }

  // --- Post-Search Processing (Deduplication) --- 
  console.log("Total results before deduplication:", finalResults.length)
  deduped = deduplicateDocuments(finalResults)
  console.log("Deduplicated results:", deduped.length)

  if (deduped.length === 0) {
    console.log("Search worker: No results found after search and deduplication.")
    return
  }

  // --- Set Output --- 
  worker.fields.output.value = deduped
  worker.fields.references.value = deduped.map(d => ({
    link: d.ref || d.source || "",
    title: d.title || "Search Result"
  }))

  console.log("Search worker execution finished.")
}


export const search: WorkerRegistryItem = {
  title: "Search",
  execute,
  category: "tool",
  type: "search",
  description: "This worker allows you to search for information in the knowledge base",
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "search",
        parameters: {},
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "doc", direction: "output", title: "Documents", name: "output" },
        { type: "references", direction: "output", title: "References", name: "references" },

        { type: "string", direction: "input", title: "Engine", name: "engine" },
        { type: "string[]", direction: "input", title: "Domain", name: "domain" },
        { type: "number", direction: "input", title: "Distance", name: "distance" },
        { type: "number", direction: "input", title: "Max Results", name: "maxResults" },
        { type: "string", direction: "input", title: "Collections", name: "collections" },
      ],
      search
    )
  },
  get registry() { return search },
}

