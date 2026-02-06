import axios from "axios"


interface JinaResponse {
  title: string //"Why do most children affected by acute malnutrition go untreated?"
  url: string //"https://www.rescue.org/article/why-do-most-children-affected-acute-malnutrition-go-untreated",
  description: string // "Around the world, more than 45 million children under the age of five experience acute malnutrition annually. Approximately two million will die as a result."
  date: string //"Jul 19, 2024"
  content: string // "Why do most children affected by acute malnutrition go untreated? | The IRC..."
  publishedTime: string // "2023-08-02T11:28:27+0000"
  metadata: {
    lang: string // "en"
  }
}

export async function searchJina(p: VectorSerach) {

  const { query, url, limit, keys } = p
  const results: VectorDocument[] = []

  if (!keys.jina) {
    console.error("Jina: No api key provided.")
    throw new Error("Jina: No api key provided.")
  }

  let data: JinaResponse[] = null

  try {
    const r = await axios.get(`https://s.jina.ai/?q=${query}`, {
      headers: {
        Accept: "application/json",
        "X-Engine": "direct",
        "X-Retain-Images": "none",
        "X-Site": url,
        "X-Return-Format": "markdown",
        Authorization: `Bearer ${keys.jina}`,
      }
    })
    data = r.data?.data || []
  } catch (error) {
    //errors are content not found. Ignore it.
  }

  if (!data || data.length == 0) return results

  for (const r of data) {
    results.push({
      source: r.url,
      body: r.content,
      title: r.title,
      locale: r.metadata?.lang,
      origin: "jina"
    })
  }

  return results


}