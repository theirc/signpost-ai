import axios from "axios"
import * as turndown from "turndown"



export async function getArticles(brand?: string, limit?: number): Promise<any[]> {

  let brands: Brand[] = []
  let docs: any[] = []

  limit ||= 100

  const headers = {
    // Authorization: "Basic " + btoa(`${env.ZENDESK_ACCOUNT}/token` + ':' + env.ZENDESK_TOKEN),
    "Content-Type": "application/json"
  }


  if (!brand) {
    try {
      brands = (await axios.get(`https://signpost-global.zendesk.com/api/v2/brands.json?per_page=100`, { headers })).data?.brands ?? []
    } catch (err) {
      // debugger
      return docs
    }
  } else {
    brands.push({ subdomain: brand })
  }


  let count = 1
  for (const b of brands) {
    try {
      let url = `https://${b.subdomain}.zendesk.com/api/v2/help_center/articles.json?per_page=${limit}`
      const rarts = await getArts(url, limit)
      for (const article of rarts) {
        if (article.draft) continue

        // docs.push(new Document({
        //   pageContent: article.body || "",
        //   metadata: {
        //     locale: localesMap.zendeskToDirectus[article.locale] || "",
        //     source: `https://${b.subdomain}.zendesk.com/hc/en-us/articles/${article.id}`,
        //     title: article.title || "",
        //     id: article.id || 0
        //   }
        // }))

        docs.push({
          ref: `${article.id || 0}`,
          title: article.title || "",
          body: article.body || "",
          // locale: localesMap.zendeskToDirectus[article.locale] || "",
          source: `https://${b.subdomain}.zendesk.com/hc/en-us/articles/${article.id}`,
          domain: b.subdomain,
        })

      }


    } catch (error) {
      // debugger
    }
  }


  return docs.filter(doc => !!doc.body)

}


export async function getZendeskArticle(id: number, domain: string): Promise<ZendeskArticle> {

  let zdars: ZendeskArticle

  const headers = {
    // Authorization: "Basic " + btoa(`${env.ZENDESK_ACCOUNT}/token` + ':' + env.ZENDESK_TOKEN),
    "Content-Type": "application/json"
  }


  try {
    let url = `https://${domain}.zendesk.com/api/v2/help_center/articles/${id}`
    const r = await axios.get(url, { headers })
    zdars = r.data?.article
  } catch (error) {
    debugger
  }

  return zdars
}

export async function getZendeskArticles(domain: string): Promise<ZendeskArticle[]> {

  let zdars: ZendeskArticle[] = []

  const headers = {
    // Authorization: "Basic " + btoa(`${env.ZENDESK_ACCOUNT}/token` + ':' + env.ZENDESK_TOKEN),
    "Content-Type": "application/json"
  }


  try {
    let url = `https://${domain}.zendesk.com/api/v2/help_center/articles.json?per_page=100`
    const rarts = await getArts(url, 100)

    for (const article of rarts) {
      if (article.draft) continue
      if (!article.body) continue
      zdars.push(article)
    }

  } catch (error) {
    debugger
  }


  return zdars

}

export async function getDomains(): Promise<string[]> {

  const headers = {
    // Authorization: "Basic " + btoa(`${env.ZENDESK_ACCOUNT}/token` + ':' + env.ZENDESK_TOKEN),
    "Content-Type": "application/json"
  }

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

export async function getDomainById(id: string | number): Promise<string> {

  const headers = {
    // Authorization: "Basic " + btoa(`${env.ZENDESK_ACCOUNT}/token` + ':' + env.ZENDESK_TOKEN),
    "Content-Type": "application/json"
  }

  const allbrands = (await axios.get(`https://signpost-global.zendesk.com/api/v2/brands.json`, { headers })).data?.brands ?? []

  for (const b of allbrands) {
    try {
      if (b.id == id) return b.subdomain
    } catch (error) {
      debugger
    }
  }


}

async function getArts(url: string, limit?: number): Promise<ZendeskArticle[]> {

  const headers = {
    // Authorization: "Basic " + btoa(`${env.ZENDESK_ACCOUNT}/token` + ':' + env.ZENDESK_TOKEN),
    "Content-Type": "application/json"
  }

  let arts = []

  let response: Response

  try {
    response = (await axios.get(url, { headers })).data || {}
  } catch (err) {
    // debugger
  }

  if (!response) return arts

  arts = response.articles || []

  if (limit && arts.length < limit) return arts

  while (response.next_page) {
    try {
      response = (await axios.get(response.next_page, { headers })).data || {}
    } catch (err) {
      // debugger
      return arts
    }
    if (response.articles) arts = [...arts, ...response.articles]
  }
  return arts
}

async function search({ query, domain, limit = 10, keys, baseUrl }: VectorSerach): Promise<VectorDocument[]> {

  if (!query) return []
  if (!domain) throw new Error("Domain is required")
  if (!keys.zendesk) throw new Error("Zendesk API key is required")

  domain = domain.trim()

  query = `${query.trim()}`
  const res = await axios.get<ZendeskSearchResult>(`https://${domain}.zendesk.com/api/v2/help_center/articles/search?per_page=100`, {
    headers: {
      Authorization: `Basic ${keys.zendesk}`,
      "Content-Type": "application/json"
    },
    params: {
      query,
      snippet: true,
    }
  })

  if (!res.data || !res.data.results || res.data.results.length == 0) return []

  const pages = res.data.results.slice(0, limit)

  const turndownService = new turndown.default()

  if (baseUrl && baseUrl.endsWith("/")) baseUrl = baseUrl.substring(0, baseUrl.length - 1)


  const results = pages.map((item) => {
    const v: VectorDocument = {
      body: turndownService.turndown(item.body),
      title: item.name || item.title,
      source: baseUrl ? `${baseUrl}/${item.id}` : item.html_url,
      locale: item.locale,
      ref: `${item.id}`,
      origin: "zendesk",
    }
    return v
  })

  return results

}


export const zendesk = {
  getArticles,
  getZendeskArticles,
  getZendeskArticle,
  getDomains,
  search,
}





interface ZendeskSearchResult {
  count: number
  next_page: string
  page: number
  page_count: number
  per_page: number
  previous_page: string
  results: ZendeskArticle[]
}



interface Brand {
  subdomain?: string
}

interface Response {
  count?: number
  next_page?: string
  page?: number
  page_count?: number
  per_page?: number
  previous_page?: string
  articles?: ZendeskArticle[]
}



interface ZendeskArticle {
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
  snippet?: string
}
