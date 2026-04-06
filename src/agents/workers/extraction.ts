
declare global {
  interface ExtractionWorker extends AIWorker {
    fields: {
      input: NodeIO
      files: NodeIO
      quickReplies: NodeIO
      cleanText: NodeIO
    }
    parameters: {
      fileTypes: string[]
    }
  }
}

function extractQuickReplies(input: string) {

  if (!input) return { quickReplies: [], cleanText: '' }

  const bracketedRegex = /\[([^\]]+)\]/g
  const quickReplies: string[] = []
  let match
  while ((match = bracketedRegex.exec(input)) !== null) {
    quickReplies.push(match[1])
  }
  // Remove all [bracketed] text from input
  input = input.replace(/\[[^\]]+\]/g, '').trim()

  return { quickReplies, cleanText: input }
}

function extractFiles(input: string, fileTypes: string[]) {

  if (!input || !fileTypes || fileTypes.length === 0) return {
    files: [],
    cleanText: input
  }

  const media_urls: string[] = []

  const extPattern = fileTypes.join("|")
  const allowedExt = new RegExp(`\\.(${extPattern})(\\?[^\\)\\s]*)?$`, "i")

  // First, extract markdown file URLs: ![alt](url) or [text](url)
  const markdownFileRegex = /!?\[.*?\]\((https?:\/\/[^\)\s]+)\)/gi

  let match

  while ((match = markdownFileRegex.exec(input)) !== null) {
    if (allowedExt.test(match[1])) media_urls.push(match[1])
  }

  // Remove only markdown links/images that are supported file types from input
  input = input.replace(/!?\[.*?\]\((https?:\/\/[^\)\s]+)\)/gi, (full, url) => allowedExt.test(url) ? '' : full).trim()

  // Then, extract plain URLs (not in markdown format)
  const plainFileRegex = /(?<!\]\()https?:\/\/[^\s<>]+/gi
  while ((match = plainFileRegex.exec(input)) !== null) {
    if (allowedExt.test(match[0])) media_urls.push(match[0])
  }

  // Remove only plain URLs that are supported file types from input
  input = input.replace(/(?<!\]\()https?:\/\/[^\s<>]+/gi, (url) => allowedExt.test(url) ? '' : url).trim()
  return {
    files: media_urls,
    cleanText: input
  }
}


async function execute(worker: ExtractionWorker, p: AgentParameters) {

  let input = worker.fields.input.value
  if (!input) return

  const { quickReplies, cleanText } = extractQuickReplies(input)
  const { files, cleanText: cleanText2 } = extractFiles(cleanText, worker.parameters.fileTypes)

  worker.fields.files.value = files || []
  worker.fields.quickReplies.value = quickReplies || []
  worker.fields.cleanText.value = cleanText2 || ''

}

export const extraction: WorkerRegistryItem = {
  title: "Extraction",
  category: "tool",
  type: "extraction",
  description: "Extracts files, quick replies, and clean text from input text.",
  execute,
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "extraction",
        parameters: {
          fileTypes: [],
        },
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "string[]", direction: "output", title: "Files", name: "files" },
        { type: "string[]", direction: "output", title: "Quick Replies", name: "quickReplies" },
        { type: "string", direction: "output", title: "Clean Text", name: "cleanText" },
      ],
      extraction
    )
  },
  get registry() { return extraction },
}
