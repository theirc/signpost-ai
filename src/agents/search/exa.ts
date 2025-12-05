import axios from 'axios'

export async function searchExa(p: VectorSerach) {

  let { query, domain, limit, keys } = p
  limit = limit || 10
  domain = domain || ""

  let results: VectorDocument[] = []

  if (!keys.exa) {
    console.log("Exa: No api key provided.")
    throw new Error("Exa: No api key provided.")
  }

  const r = await axios.post('https://signpost-ia-app-qa.azurewebsites.net/exa', {
    query,
    limit,
    domain,
    key: keys.exa
  })

  const data = r.data || []

  for (const r of data) {
    results.push({
      source: r.url,
      body: r.text,
      title: r.title,
      origin: "exa"
    })
  }

  // const exa = new Exa(keys.exa)
  // const result = await exa.searchAndContents(
  //   query,
  //   {
  //     type: "auto",
  //     useAutoprompt: true,
  //     numResults: limit || 10,
  //     text: true,
  //     includeDomains: [domain],
  //   }
  // )
  // for (const r of result.results) {
  //   results.push({
  //     source: r.url,
  //     body: r.text,
  //     title: r.title,
  //   })
  // }

  return results

}