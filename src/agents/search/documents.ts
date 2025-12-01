import OpenAI from "openai"

declare global {
  type SupportedVectorExtensions = keyof typeof supportedExtensions
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

  const openai = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

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
