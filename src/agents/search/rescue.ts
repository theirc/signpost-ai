import axios from "axios"
import * as turndown from "turndown"

interface ResponseToken {
  access_token: string
  token_type: string // "bearer",
  expires_in: number // 1199,
  refresh_token: string // "4abc82ac-f109-4e9a-b90d-b7d37a225ed7",
  tenant: string // "1d66cefd-1066-4829-a6e7-763192cf0847",
  expires: string // "2026-01-09T20:56:52.0000000+00:00",
  issued: string // "2026-01-09T20:36:52.0000000+00:00"
}

interface SearchResult {
  Id: string // "1788",
  Title: string // "2026 Benefits Open Enrollment",
  Summary: string // "This information applies to: International and US Domestic Employees. Open Enrollment for US and International benefit plans will be from November 10 through November 23 for benefit changes with an effective date of January 1, 2026.",
  DateAdded: string // "2018-11-12T14:28:00Z",
  DateUpdated: string // "2025-11-13T22:27:13.843Z",
  Url: string // "/Interact/Pages/Content/Document.aspx?id=1788&utm_source=interact&utm_term=Medical&searchId=9734422",
  IsBestBet: boolean // true,
}

interface ResponseSearch {
  SearchExecutionTime: 178 // in ms
  TotalResults: number
  Results: SearchResult[]
}

interface RescuePage {
  Id: number
  Permalink: string
  Title: string //  "Cigna Wellness Experience"
  Content: {
    Html: string //"<div id=..."
    Link: string
    Url: string
  },
}


const token = {
  last: "",
  expires: 0,
}

const defaultHeaders = {
  "X-Tenant": "1d66cefd-1066-4829-a6e7-763192cf0847",
}

async function getToken(key: string) {

  // key = "a56890a935__740$d3!£%3"

  if (token.last == key && (token.expires - 10000) > Date.now()) {
    return token.last
  }

  const body = {
    url: "https://us-lb-api-01.interactgo.com/token?personid=279",
    headers: {
      ...defaultHeaders,
      "Content-Type": "application/x-www-form-urlencoded",
      "Accept": "application/json"
    },
    grant_type: "authorization_code",
    context: "KeySecret",
    code: `${key}`
  }

  try {
    console.log("Regenerating Token...")
    const r = await axios.post<ResponseToken>("https://signpost-ia-app-qa.azurewebsites.net/decors", body)
    console.log("Token: ", r.data)

    if (r.data.access_token) {
      token.last = r.data.access_token
      token.expires = Date.now() + r.data.expires_in * 1000
      return token.last
    }

  } catch (error) {
    debugger
  }

  return null
}

async function search({ keys, limit, query }: VectorSerach) {

  const token = await getToken(keys.rescuenet)
  const documents: VectorDocument[] = []
  const turndownService = new turndown.default()

  const body = {
    method: "GET",
    url: `https://us-lb-api-01.interactgo.com/api/search?searchTerm=${query}&type=Page`,
    headers: {
      ...defaultHeaders,
      Authorization: `Bearer ${token}`,
    },
  }

  const r = await axios.post<ResponseSearch>("https://signpost-ia-app-qa.azurewebsites.net/decors", body)

  if (!r.data || r.data.TotalResults == 0) return documents

  const resultToGather = r.data.Results.slice(0, limit)

  const promises = resultToGather.map((item) => {
    const body = {
      method: "GET",
      url: `https://us-lb-api-01.interactgo.com/api/page/${item.Id}/composer/latest`,
      headers: {
        ...defaultHeaders,
        Authorization: `Bearer ${token}`,
      },
    }
    return axios.post<RescuePage>("https://signpost-ia-app-qa.azurewebsites.net/decors", body).then(r => {
      return r.data
    })
  })

  const allPages = await Promise.allSettled(promises)

  for (const page of allPages) {
    if (page.status == "fulfilled") {
      const source = resultToGather.find(item => item.Id == page.value.Id as any)?.Url ?? ""
      documents.push({
        source: `https://rescuenet.rescue.org/page/${page.value.Id}`,
        body: turndownService.turndown(page.value.Content.Html || ""),
        title: page.value.Title,
        origin: "rescuenet"
      })
    }
  }

  console.log("Rescue.net:", documents)
  return documents
}


export const rescue = {
  getToken,
  search,
}  
