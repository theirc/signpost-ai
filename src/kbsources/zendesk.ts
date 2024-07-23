import axios, { type AxiosResponse } from "axios"
import { vector } from "../vector/vector"
import { converters } from "../vector/converters"

const headers = {
  Authorization: "Basic " + Buffer.from(`${process.env.ZENDESK_ACCOUNT}/token` + ':' + process.env.ZENDESK_TOKEN).toString('base64'),
  "Content-Type": "application/json"
}


async function getArts(url: string): Promise<Article[]> {

  let arts: Article[] = []

  let response: ZendeskResponse

  try {
    response = (await axios.get<ZendeskResponse>(url, { headers })).data || {} as any
  } catch (err) {
    return []
    debugger
  }

  if (!response) return arts

  arts = response.articles || []

  while (response.next_page) {
    try {
      response = (await axios.get(response.next_page, { headers })).data || {}
    } catch (err) {
      debugger
      return arts
    }
    if (response.articles) arts = [...arts, ...response.articles]
  }
  return arts
}


async function getArticles(domain: string): Promise<Article[]> {

  let zdars: Article[] = []

  try {
    console.log(`Getting articles for domain ${domain}...`)
    const rarts = await getArts(`https://${domain}.zendesk.com/api/v2/help_center/articles.json?per_page=100`)
    console.log(`${domain}: ${rarts.length} articles.`)
    for (const article of rarts) {
      if (article.draft) continue
      if (!article.body) continue
      zdars.push(article)
    }

  } catch (error) {
    debugger
  }

  console.log(`Articles gathering for domain ${domain} done.`)

  return zdars

}


async function getDomains(): Promise<string[]> {

  let brands: string[] = []

  const allbrands = (await axios.get(`https://signpost-global.zendesk.com/api/v2/brands.json?per_page=100`, { headers })).data?.brands ?? []

  for (const b of allbrands) {
    try {
      brands.push(b.subdomain)
    } catch (error) {
      debugger
    }
  }

  return brands

}

async function sendComment(id: number, body: string) {
  try {
    await axios.put(`https://signpost-global.zendesk.com/api/v2/tickets/${id}.json`, {
      ticket: {
        comment: {
          body
        }
      }
    }, { headers })
  } catch (error) {
    debugger
  }
}

async function getComments(id: number): Promise<string> {

  let comments: ZendeskComment[] = []

  try {
    let response: ZendeskCommentsResponse = (await axios.get(`https://signpost-global.zendesk.com/api/v2/tickets/${id}/comments.json`, { headers })).data || {}
    comments = response.comments || []
    while (response.next_page) {
      try {
        response = (await axios.get(response.next_page, { headers })).data || {}
      } catch (err) {
        debugger
      }
      if (response.comments) comments = [...comments, ...response.comments]
    }
  } catch (err) {
    debugger
  }

  const allComments = comments.map((comment) => `Message: ${comment.body}`).join("\n\n")

  const final = `

  Use this previous conversation as an additional context:
  <previous messages>
  ${allComments}
  </previous messages>

  `

  return final

}


async function buildZendeskVectorsForDomain(domain: string) {

  console.log(`Bulding Zendesk vectors for domain '${domain}'...`)

  const arts = await getArticles(domain)
  if (arts.length == 0) return

  let count = 1
  let total = arts.length

  for (const art of arts) {
    const source = art.url
    const title = art.title || ""
    const id = art.id || 0
    let content = art.body || ""

    if (!id || !content) {
      debugger
      continue
    }

    content = converters.htmlToMarkdown(content)

    console.log(`Processing Article ${title}: ${count++}/${total}`)

    await vector.upsertArticle(id, {
      title,
      body: content,
      origin: 'zd',
      domain,
      source,
    })
  }

}

async function buildZendeskVectors() {

  console.log("Bulding Zendesk vectors...")

  const domains = await getDomains()

  const totalDomains = domains.length
  let domainCount = 1

  for (const domain of domains) {
    console.log(`Processing Zendesk domain  ${domainCount}/${totalDomains}`)
    await buildZendeskVectorsForDomain(domain)
    domainCount++
  }

  console.log(`${domains.length} domains processed.`)

}


export const zendesk = {
  buildZendeskVectors,
  buildZendeskVectorsForDomain,
  getComments,
  sendComment,
  getDomains,
  getArticles,
}



interface ZendeskCommentsResponse {
  comments?: ZendeskComment[],
  next_page?: string
  previous_page?: string
  count?: number
}

interface ZendeskComment {
  author_id?: number
  body?: string
  created_at?: string
}


interface ZendeskResponse {
  count?: number
  next_page?: string
  page?: number
  page_count?: number
  per_page?: number
  previous_page?: string
  articles?: Article[]
}

interface Article {
  id?: number
  url?: string
  html_url?: string
  draft?: boolean
  created_at?: string
  updated_at?: string
  edited_at?: string
  name?: string
  title?: string
  source_locale?: string
  locale?: string
  body?: string
}

