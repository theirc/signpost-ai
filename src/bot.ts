import { ai } from "./ai"
import { db } from "./db"
import { zendesk } from "./sources"
import { schemas } from "./schemas"
import { routerSchema, RouterSchema } from "./schemas/rounterschema"
import { vector } from "./vector/vector"
import { hrtime } from 'node:process'
import { createJsonTranslator, createLanguageModel, } from "typechat"
import { createTypeScriptJsonValidator } from "typechat/ts"

export class Bot {

  private perfinit: number | bigint = 0
  private perfrouting: number | bigint = 0
  private perfsearch: number | bigint = 0
  private perfllmcall: number | bigint = 0
  private perfconstitutional: number | bigint = 0

  constructor(public config: BotConfig) { }

  async execute(req: BotRequest) {

    let { message, chunked, } = req

    const userHistory: ChatHistoryItem[] = (req.history || []).map((h) => ({ role: h.isHuman ? "user" : "assistant", content: h.message }))

    if (req.zendeskid) {
      const comments = await zendesk.getComments(req.zendeskid)
      message = `${comments}\n\n${message}`
    }

    this.perfrouting = perf()
    const router = await schemas.create<RouterSchema>(message, routerSchema, "RouterSchema")
    if (!router && this.config.kbtype != "vectorless") {
      const e = { error: "Failed to route question" }
      await db.saveLog(e)
      return e
    }
    this.perfrouting = perf(this.perfrouting)

    const { isContact, searchTerms, language, location } = router
    const activeChannels = this.config.channels.filter((channel: Channel) => !channel.disable)

    const ailog: AILog = {
      user_message: message,
      bot: this.config.id,
      router_isContact: isContact,
      router_searchTerms: searchTerms,
      router_language: language,
      router_location: location,
      final_prompt: this.config.prompt,
    }

    if (isContact && activeChannels.length > 0) {
      ailog.answer = "These are the communication channels:"
      await db.saveLog(ailog)
      return {
        isContacts: true,
        message: "These are the communication channels:",
        docs: activeChannels.map((channel: Channel) => ({ pageContent: channel.link, metadata: { title: channel.title, source: channel.link } }))
      }
    }

    let docs: Doc[] = []

    if (this.config.countries.length > 0 || this.config.zddomains.length > 0 || this.config.solinum) {
      const countries = this.config.countries
      const domains = this.config.zddomains
      if (this.config.solinum) domains.push("solinum")
      this.perfsearch = perf()
      docs = await vector.search({
        query: message,
        countries,
        domains,
        limit: this.config.maxresults,
        distance: this.config.distance,
      })
      this.perfsearch = perf(this.perfsearch)
    }

    let history: ChatHistoryItem[] = [
      { role: 'assistant', content: this.config.prompt }
    ]

    if (this.config.enablehistory) history = [...history, ...userHistory]

    if (docs.length > 0 && this.config.kbtype != "vectorless") {
      history.push({
        role: 'user', content: `
        Use this context for the conversation: 
        <Context> 
        ${docs.map((doc: Doc) => `Title: ${doc.title}\nContent: ${doc.body}`).join("\n\n")}
        </Context>`
      })
    }

    history.push({ role: 'user', content: message })

    this.perfllmcall = perf()
    const llmAnswer = await ai.request({
      model: this.config.model,
      provider: this.config.llm,
      temperature: this.config.temperature,
      history,
    })
    this.perfllmcall = perf(this.perfllmcall)



    this.perfconstitutional = perf()
    const censored = await this.runConstitutional(llmAnswer.answer)
    this.perfconstitutional = perf(this.perfconstitutional)

    let sr = ""

    for (const doc of docs) {
      let sritem = "==================================================" + "\n"
      sritem += `Title: ${doc.metadata.title}\n`
      sritem += `Source: ${doc.metadata.source}\n`
      sritem += `ID: ${doc.metadata.id}\n`
      sritem += `Latitude: ${doc.metadata.lat || ""}\n`
      sritem += `Longitude: ${doc.metadata.lon || ""}\n`
      sritem += `Country: ${doc.metadata.country || ""}\n`
      sritem += `Orgin: ${doc.metadata.origin || ""}\n`
      sritem += `Domain: ${doc.metadata.domain || ""}\n`
      sritem += `Lines from ${doc.metadata.fromLine || 0} to ${doc.metadata.toLine || 0}\n`
      sritem += `Content: ${doc.body}\n`
      sritem += `\n\n`
      sr += sritem
    }
    ailog.search_results = sr
    ailog.answer = llmAnswer.answer
    ailog.answer_constitutional = censored
    await db.saveLog(ailog)

    const answer: Answer = {
      message: censored,
      docs: this.deduplicateDocuments(docs),
      isAnswer: true,
    }

    if (chunked) answer.chunked = this.splitTextIntoChunks(answer.message)
    if (req.zendeskid) await zendesk.sendComment(req.zendeskid, answer.message)
    return answer
  }

  splitTextIntoChunks(text: string, chunkSize: number = 280): string[] {
    const chunks: string[] = []
    let currentChunk = ""
    for (let i = 0; i < text.length; i++) {
      currentChunk += text[i]
      if (currentChunk.length >= chunkSize) {
        chunks.push(currentChunk)
        currentChunk = ""
      }
    }
    if (currentChunk.length > 0) chunks.push(currentChunk)
    return chunks
  }



  async runConstitutional(answer: string): Promise<string> {
    if (!this.config.constitution || !this.config.constitution.length) return answer
    let content = answer
    for (let c of this.config.constitution) {
      if (c.critique && c.revision) {
        let history: ChatHistoryItem[] = [
          { role: 'assistant', content: c.critique },
          { role: 'assistant', content: c.revision },
          { role: 'user', content },
        ]
        const newMessage = (await ai.request({
          model: "gpt-4o",
          provider: "openai",
          history
        })).answer
        if (newMessage) content = newMessage
      }
    }
    return content
  }



  deduplicateDocuments(array: Doc[]): Doc[] {
    const seen = {}
    const deduped: Doc[] = []

    for (const d of array) {
      if (!seen[d.source]) {
        deduped.push(d)
        seen[d.source] = true
      }
    }

    return deduped
  }

  static async fromId(id: number): Promise<Bot> {
    const cfg = await db.getBotConfig(id)
    const b = new Bot(cfg)
    return b
  }

}

function perf(start?: bigint): bigint {
  if (!start) return hrtime.bigint()
  const nanoseconds = hrtime.bigint() - start
  return (Number((Number(nanoseconds) / 1000000000).toFixed(2))) || 0 as any
}