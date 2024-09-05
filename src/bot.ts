import { ai } from "./ai"
import { zendesk } from "./sources"
import { schemas } from "./schemas"
import { routerSchema, RouterSchema } from "./schemas/rounterschema"
import { vector } from "./vector/vector"
import { hrtime } from 'node:process'

export class Bot {

  private perfinit: number | bigint = 0
  private perfrouting: number | bigint = 0
  private perfsearch: number | bigint = 0
  private perfllmcall: number | bigint = 0
  public config: BotConfig
  constructor() { }

  async execute(req: BotRequest) {

    let { message, } = req

    if (req.zendeskid) {
      const comments = await zendesk.getComments(req.zendeskid)
      message = `${comments}\n\n${message}`
    }

    this.perfrouting = perf()
    const router = await schemas.create<RouterSchema>(message, routerSchema, "RouterSchema")
    this.perfrouting = perf(this.perfrouting)

    const { isContact, searchTerms, language, location } = router

    let docs: Doc[] = []

    if (this.config.searchDomains.length > 0) {
      const domains = this.config.searchDomains
      this.perfsearch = perf()
      docs = await vector.search({
        query: message,
        domains,
        limit: this.config.searchMaxresults,
        distance: this.config.searchDistance,
      })
      this.perfsearch = perf(this.perfsearch)
    }

    let history: ChatHistoryItem[] = [
      { role: 'assistant', content: this.config.prompt }
    ]

    if (docs.length > 0) {
      history.push({
        role: 'user', content: `
        Use this context for the conversation: 
        <Context> 
        ${docs.map((doc: Doc) => `Title: ${doc.title}\nContent: ${doc.body}`).join("\n\n")}
        </Context>`
      })
    }

    if (req.history && req.history.length > 0) {
      history = [...history, ...req.history]
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


    const answer: Answer = {
      message: llmAnswer.answer,
      docs: this.deduplicateDocuments(docs),
    }

    if (req.zendeskid) await zendesk.sendComment(req.zendeskid, answer.message)
    return answer
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

  static fromConfig(config: BotConfig) {
    const bot = new Bot()
    bot.config = config
    bot.config.temperature = bot.config.temperature || 0
    bot.config.searchDistance = bot.config.searchDistance || 0.5
    bot.config.searchMaxresults = bot.config.searchMaxresults || 5
    bot.config.searchDomains = bot.config.searchDomains || []
    bot.config.kbtype = bot.config.kbtype || "weaviate"
    bot.config.llm = bot.config.llm || "openai"
    bot.config.model = bot.config.model || "gpt-4o"
    return bot
  }

}

function perf(start?: bigint): bigint {
  if (!start) return hrtime.bigint()
  const nanoseconds = hrtime.bigint() - start
  return (Number((Number(nanoseconds) / 1000000000).toFixed(2))) || 0 as any
}
