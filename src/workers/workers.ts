type Workers = { [key in WorkerTypes]?: (worker: AgentWorker, agent: Agent, payload: object) => Promise<void> }

export const workers: Workers = {}

const knownMembers = {
  input: true,
  output: true,
  documents: true,
  prompt: true,
}

export function generateArticlesContext(docs: Doc[]): string {

  if (!docs || !docs.length) return `<articles></articles>`

  const documents = `
<articles>

${docs.map((doc: Doc, i) => `
  
  <article>
    <id>${i}</id>
    <title>${doc.title}</title>
    <content>
${doc.body}
    </content>
    <link>${doc.source}</link>
  </article>
 
  `
  ).join("\n\n")}

</articles>  
  `

  return documents

}

export function generateTemplate(a: Agent, text: string, payload: object): string {

  if (!text) return ""
  const documents = generateArticlesContext(a.documents)

  text = text.replace(/{documents}/gi, documents)
  text = text.replace(/{question}/gi, (payload as any).input || "")
  text = text.replace(/{answer}/gi, (payload as any).output || "")
  text = text.replace(/{prompt}/gi, (payload as any).prompt || "")

  for (const key in payload) {
    if (payload[key] == null) continue
    if (key in knownMembers) continue
    text = text.replace(new RegExp(`{${key}}`, "gi"), a.variables[key])
  }

  return text

  // if (!text) return ""
  // const documents = generateArticlesContext(a.documents)

  // text = text.replace(/{documents}/gi, documents)
  // text = text.replace(/{question}/gi, a.input || "")
  // text = text.replace(/{answer}/gi, a.output || "")
  // text = text.replace(/{prompt}/gi, a.prompt || "")

  // for (const key in a.variables) {
  //   if (a.variables[key] === undefined) continue
  //   text = text.replace(new RegExp(`{${key}}`, "gi"), a.variables[key])
  // }

  // return text

}
