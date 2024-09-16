import * as turndown from "turndown"
const turndownService = new turndown.default()

export const converters = {
  htmlToMarkdown: (text: string) => turndownService.turndown(text),
}
