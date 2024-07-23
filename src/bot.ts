import { ai } from "./ai"
import { db } from "./db"
import { vector } from "./vector/vector"

export class Bot {

  constructor(public config: BotConfig) { }

  async execute(req: BotRequest) {

    let { message, history } = req

    let context = ""
    let docs: Doc[] = []

    if (this.config.countries.length > 0 || this.config.zddomains.length > 0 || this.config.solinum) {
      const countries = this.config.countries
      const domains = this.config.zddomains

      if (this.config.solinum) domains.push("solinum")

      docs = await vector.search({
        query: message,
        countries,
        domains,
        limit: this.config.maxresults,
        distance: this.config.distance,
      })
    }

    context = "\n\n" + docs.map((doc: Doc) => `Title: ${doc.title}\nContent: ${doc.body}`).join("\n\n")

    // return { message: "Ok", isAnswer: true, }

    const llmAnswer = await ai.request({
      model: this.config.model,
      provider: this.config.llm,
      context,
      prompt: this.config.prompt,
      temperature: this.config.temperature,
      message,
    })

    //(await this.askToModel(message, context, history, this.config.kbtype != "vectorless")) || ""


    const answer: Answer = {
      message: llmAnswer.answer,
      docs: this.deduplicateDocuments(docs),
      isAnswer: true,
    }

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

  static async fromId(id: number): Promise<Bot> {
    const cfg = await db.getBotConfig(id)
    const b = new Bot(cfg)
    return b
  }

}

