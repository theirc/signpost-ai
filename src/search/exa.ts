import Exa from 'exa-js'
const exa = new Exa(process.env.EXA_API_KEY)

export async function searchExa(q: SearchParams) {

  const docs: Doc[] = []

  const result = await exa.searchAndContents(
    q.query,
    {
      type: "auto",
      useAutoprompt: true,
      numResults: q.limit || 10,
      text: true,
      includeDomains: q.domains,
    }
  )

  for (const r of result.results) {
    docs.push({
      title: r.title,
      source: r.url,
      body: r.text
    })
  }
  return docs
}