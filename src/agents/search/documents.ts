import OpenAI, { ClientOptions } from "openai"
import { isBrowser } from "../isbrowser"

declare global {
  type SupportedVectorExtensions = keyof typeof supportedExtensions
  interface Source {
    type: VectorSearchEngines
    sources?: number[]
    chunked?: boolean
    locale?: string
    domain?: string
    distance?: number
    results?: number
    url?: string
    baseUrl?: string
  }
}

const supportedExtensions = {
  "pdf": "application/pdf",
  "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "doc": "application/msword",
  "txt": "text/plain",
  "md": "text/markdown",
  "json": "application/json",
  "xml": "application/xml",
  "xls": "application/vnd.ms-excel",
  "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "csv": "text/csv",
  "jpg": "image/jpeg",
  "png": "image/png",
  "webp": "image/webp",
  "gif": "image/gif",
}


export async function createEmbedding(input: string, apiKey: string) {

  const request: ClientOptions = {
    apiKey,
    dangerouslyAllowBrowser: true,
  }

  if (isBrowser) {
    request.baseURL = `https://signpost-ia-app-qa.azurewebsites.net/decorsify/https://api.openai.com/v1`
  }

  const openai = new OpenAI(request)

  const embedding = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input,
    encoding_format: "float",
  })

  return embedding.data[0].embedding
}




export const documents = {
  supportedExtensions,
  createEmbedding,
}
