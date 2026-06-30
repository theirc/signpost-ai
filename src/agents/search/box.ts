import axios from 'axios'
import { isBrowser } from '../isbrowser'
//https://rescue.app.box.com/folder/306813160331
const BOX_API_BASE = 'https://api.box.com/2.0'

const MAX_FILE_CHARS = 20000
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'xml', 'html', 'htm', 'js', 'ts', 'py', 'rb', 'java', 'c', 'cpp', 'h', 'css', 'yaml', 'yml', 'toml', 'sh', 'log', 'rst', 'tex'])
const REPRESENTATION_EXTENSIONS = new Set(['xlsx', 'xls', 'docx', 'doc', 'pptx', 'ppt', 'pdf', 'numbers', 'pages', 'key'])

function extractFolderId(domain: string): string | null {
  if (!domain) return null
  try {
    const parsed = new URL(domain.trim())
    const match = parsed.pathname.match(/\/folder\/(\d+)/)
    if (match) return match[1]
  } catch { }
  const fallback = domain.match(/\/folder\/(\d+)/) || domain.match(/(\d+)/)
  return fallback ? fallback[1] : null
}

function truncate(text: string): string {
  if (text.length <= MAX_FILE_CHARS) return text
  return text.slice(0, MAX_FILE_CHARS) + `\n\n[Truncated — ${text.length} total chars]`
}

async function readFileContent(token: string, fileId: string, extension?: string, size?: number): Promise<string> {

  const ext = (extension || '').toLowerCase()
  const headers = { Authorization: `Bearer ${token}` }

  if ((size || 0) > 10 * 1024 * 1024) return ""

  let decors = ""
  if (isBrowser) decors = `https://signpost-ia-app-qa.azurewebsites.net/decorsify/`


  if (TEXT_EXTENSIONS.has(ext)) {
    const res = await axios.get(`${decors}${BOX_API_BASE}/files/${fileId}/content`, { headers, responseType: 'text' })
    return truncate(typeof res.data === 'string' ? res.data : String(res.data))
  }

  if (REPRESENTATION_EXTENSIONS.has(ext)) {
    const repHeaders = { ...headers, 'X-Rep-Hints': '[extracted_text]' }

    const rep = await axios.get(`${decors}${BOX_API_BASE}/files/${fileId}?fields=representations`, { headers: repHeaders })
    const textRep = (rep.data?.representations?.entries || []).find((e: any) => e.representation === 'extracted_text')
    if (!textRep) return ""

    if (textRep.status?.state === 'none' || textRep.status?.state === 'pending') {
      if (textRep.info?.url) await axios.get(textRep.info.url, { headers }).catch(() => { })
    }

    let state = textRep.status?.state
    let urlTemplate = textRep.content?.url_template
    for (let i = 0; i < 10 && state !== 'success' && state !== 'error'; i++) {
      await new Promise(r => setTimeout(r, 1500))
      const poll = await axios.get(`${decors}${BOX_API_BASE}/files/${fileId}?fields=representations`, { headers: repHeaders })
      const updated = (poll.data?.representations?.entries || []).find((e: any) => e.representation === 'extracted_text')
      if (updated) {
        state = updated.status?.state
        urlTemplate = updated.content?.url_template
      }
    }

    if (state === 'success' && urlTemplate) {
      const contentUrl = urlTemplate.replace('{+asset_path}', '')
      const textRes = await axios.get(contentUrl, { headers, responseType: 'text' })
      return truncate(typeof textRes.data === 'string' ? textRes.data : String(textRes.data))
    }
  }

  return ""
}

export async function searchBox(p: VectorSerach) {

  let { query, domain, limit, keys } = p
  limit = limit || 10
  domain = domain || ""
  let results: VectorDocument[] = []

  if (!keys.boxnet) {
    console.error("Box.net: No api key provided.")
    throw new Error("Box.net: No api key provided.")
  }

  const folderId = extractFolderId(domain)
  if (!folderId) {
    console.error("Box.net: Could not extract folder id from domain.")
    throw new Error("Box.net: Could not extract folder id from domain.")
  }

  let decors = ""
  if (isBrowser) decors = `https://signpost-ia-app-qa.azurewebsites.net/decorsify/`

  const response = await axios.get(`${decors}${BOX_API_BASE}/search`, {
    headers: { Authorization: `Bearer ${keys.boxnet}` },
    params: {
      query,
      ancestor_folder_ids: folderId,
      fields: 'name,type,id,size,modified_at,parent,extension',
      limit,
    }
  })

  const entries = (response.data?.entries || []).filter((item: any) => item.type === 'file')



  const docs = await Promise.all(entries.map(async (item: any) => {
    const body = await readFileContent(keys.boxnet, item.id, item.extension, item.size).catch(() => "")
    if (!body) return null
    const v: VectorDocument = {
      body,
      title: item.name || "",
      source: `https://rescue.app.box.com/folder/${item.id}`,
      ref: `${item.id}`,
      origin: "box",
    }
    return v
  }))

  results = docs.filter((d): d is VectorDocument => d !== null)

  return results

}
