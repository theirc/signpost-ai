import axios from "axios"


interface ChannelSearchResult {
  items?: {
    id?: string // "UC48pfslXOUx-PZTLQxZjS4g",
  }[]
}

interface YoutubeSearchResult {
  nextPageToken: string // "CAUQAA",
  pageInfo?: {
    totalResults?: number // 216,
    resultsPerPage?: number // 5
  },
  items?: {
    id?: {
      videoId?: string // "Xm5C2OPygA4"
    },
    snippet?: {
      title?: string // "أهلاً سمسم: لغة الإشارة - هل أنت بخير؟",
      description?: string // "تعلموا كيفية قول جملة \"هل أنت بخير؟\" بلغة الإشارة مع غرغور والأصدقاء! هل تبحثون عن المزيد من المقاطع التعليمية وقصص الأطفال؟",
    }
  }[]
}



export async function searchYouTube(p: VectorSerach) {
  debugger

  let results: VectorDocument[] = []

  const { query, domain, limit, keys } = p
  let apiKey = keys.youtube

  if (!domain) {
    console.log("YouTube: No domain provided.")
    return results
  }
  if (!apiKey) {
    console.log("YouTube: No api key provided.")
    throw new Error("YouTube: No api key provided.")
  }

  try {

    const channelsRequest = await axios.get<ChannelSearchResult>(`https://www.googleapis.com/youtube/v3/channels?part=snippet&forHandle=${domain}&key=${apiKey}`)
    const channelId = channelsRequest.data.items?.[0]?.id

    if (!channelId) {
      console.log("YouTube: No channel found for domain:", domain)
      throw new Error("YouTube: No channel found for domain:" + domain)
    }

    const searchRequest = await axios.get<YoutubeSearchResult>(`https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${channelId}&q=${query}&type=video&key=${apiKey}`)
    const videos = searchRequest.data.items || []

    for (const v of videos) {
      results.push({
        ref: v.id?.videoId || "",
        title: v.snippet?.title || "",
        body: v.snippet?.description || "",
        source: `https://www.youtube.com/watch?v=${v.id?.videoId || ""}`,
        origin: "youtube",
      })
    }

  } catch (error) {
    console.log("Error:", error.toString())
    throw error
  }

  return results

}
