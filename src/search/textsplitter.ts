
interface TextSplitterParams {
  chunkSize: number
  chunkOverlap: number
  keepSeparator: boolean
}

type TextSplitterChunkHeaderOptions = {
  chunkHeader?: string
  chunkOverlapHeader?: string
  appendChunkOverlapHeader?: boolean
}

abstract class TextSplitter implements TextSplitterParams {
  chunkSize = 1536;
  chunkOverlap = 200;
  keepSeparator = false;
  lengthFunction: | ((text: string) => number) | ((text: string) => number)

  constructor(fields?: Partial<TextSplitterParams>) {
    this.chunkSize = fields?.chunkSize ?? this.chunkSize
    this.chunkOverlap = fields?.chunkOverlap ?? this.chunkOverlap
    this.keepSeparator = fields?.keepSeparator ?? this.keepSeparator
    this.lengthFunction = ((text: string) => text.length)
    if (this.chunkOverlap >= this.chunkSize) throw new Error("Cannot have chunkOverlap >= chunkSize")
  }


  abstract splitText(text: string): string[]

  protected splitOnSeparator(text: string, separator: string): string[] {
    let splits
    if (separator) {
      if (this.keepSeparator) {
        const regexEscapedSeparator = separator.replace(/[/\-\\^$*+?.()|[\]{}]/g, "\\$&")
        splits = text.split(new RegExp(`(?=${regexEscapedSeparator})`))
      } else {
        splits = text.split(separator)
      }
    } else {
      splits = text.split("")
    }
    return splits.filter((s: string) => s !== "")
  }

  createDocuments(texts: string[], chunkHeaderOptions: TextSplitterChunkHeaderOptions = {}): Doc[] {

    const { chunkHeader = "", chunkOverlapHeader = "(cont'd) ", appendChunkOverlapHeader = false, } = chunkHeaderOptions

    const documents = new Array<Doc>()

    for (let i = 0; i < texts.length; i += 1) {
      const text = texts[i]
      let lineCounterIndex = 1
      let prevChunk = null
      let indexPrevChunk = -1
      for (const chunk of this.splitText(text)) {
        let pageContent = chunkHeader

        // we need to count the \n that are in the text before getting removed by the splitting
        const indexChunk = text.indexOf(chunk, indexPrevChunk + 1)
        if (prevChunk === null) {
          const newLinesBeforeFirstChunk = this.numberOfNewLines(text, 0, indexChunk)
          lineCounterIndex += newLinesBeforeFirstChunk

        } else {

          const indexEndPrevChunk = indexPrevChunk + this.lengthFunction(prevChunk)

          if (indexEndPrevChunk < indexChunk) {
            const numberOfIntermediateNewLines = this.numberOfNewLines(text, indexEndPrevChunk, indexChunk)
            lineCounterIndex += numberOfIntermediateNewLines

          } else if (indexEndPrevChunk > indexChunk) {
            const numberOfIntermediateNewLines = this.numberOfNewLines(text, indexChunk, indexEndPrevChunk)
            lineCounterIndex -= numberOfIntermediateNewLines
          }
          if (appendChunkOverlapHeader) pageContent += chunkOverlapHeader
        }

        const newLinesCount = this.numberOfNewLines(chunk)
        const fromLine = lineCounterIndex
        const toLine = lineCounterIndex + newLinesCount

        pageContent += chunk
        documents.push(
          {
            body: pageContent,
            fromLine,
            toLine,
          }
        )
        lineCounterIndex += newLinesCount
        prevChunk = chunk
        indexPrevChunk = indexChunk
      }
    }
    return documents
  }

  private numberOfNewLines(text: string, start?: number, end?: number) {
    const textSection = text.slice(start, end)
    return (textSection.match(/\n/g) || []).length
  }

  splitDocuments(documents: Doc[], chunkHeaderOptions: TextSplitterChunkHeaderOptions = {}): Doc[] {
    const selectedDocuments = documents.filter((doc) => doc.body !== undefined)
    const texts = selectedDocuments.map((doc) => doc.body)
    return this.createDocuments(texts, chunkHeaderOptions)
  }

  private joinDocs(docs: string[], separator: string): string | null {
    const text = docs.join(separator).trim()
    return text === "" ? null : text
  }

  mergeSplits(splits: string[], separator: string): string[] {
    const docs: string[] = []
    const currentDoc: string[] = []
    let total = 0
    for (const d of splits) {
      const _len = this.lengthFunction(d)
      if (total + _len + currentDoc.length * separator.length > this.chunkSize) {
        if (total > this.chunkSize) {
          console.warn(`Created a chunk of size ${total}, + which is longer than the specified ${this.chunkSize}`)
        }

        if (currentDoc.length > 0) {
          const doc = this.joinDocs(currentDoc, separator)
          if (doc !== null) {
            docs.push(doc)
          }
          // Keep on popping if:
          // - we have a larger chunk than in the chunk overlap
          // - or if we still have any chunks and the length is long
          while (
            total > this.chunkOverlap ||
            (total + _len + currentDoc.length * separator.length > this.chunkSize && total > 0)
          ) {
            total -= this.lengthFunction(currentDoc[0])
            currentDoc.shift()
          }
        }
      }
      currentDoc.push(d)
      total += _len
    }
    const doc = this.joinDocs(currentDoc, separator)
    if (doc !== null) docs.push(doc)
    return docs
  }
}

interface RecursiveCharacterTextSplitterParams
  extends TextSplitterParams {
  separators: string[]
}

const SupportedTextSplitterLanguages = ["markdown", "html"] as const
type SupportedTextSplitterLanguage = (typeof SupportedTextSplitterLanguages)[number]

export class RecursiveCharacterTextSplitter extends TextSplitter implements RecursiveCharacterTextSplitterParams {

  separators: string[] = ["\n\n", "\n", " ", ""];

  constructor(fields?: Partial<RecursiveCharacterTextSplitterParams>) {
    super(fields)
    this.separators = fields?.separators ?? this.separators
    this.keepSeparator = fields?.keepSeparator ?? true
  }

  private _splitText(text: string, separators: string[]) {
    const finalChunks: string[] = []

    // Get appropriate separator to use
    let separator: string = separators[separators.length - 1]
    let newSeparators
    for (let i = 0; i < separators.length; i += 1) {
      const s = separators[i]
      if (s === "") {
        separator = s
        break
      }
      if (text.includes(s)) {
        separator = s
        newSeparators = separators.slice(i + 1)
        break
      }
    }

    // Now that we have the separator, split the text
    const splits = this.splitOnSeparator(text, separator)

    // Now go merging things, recursively splitting longer texts.
    let goodSplits: string[] = []
    const _separator = this.keepSeparator ? "" : separator

    for (const s of splits) {
      if ((this.lengthFunction(s)) < this.chunkSize) {
        goodSplits.push(s)
      } else {
        if (goodSplits.length) {
          const mergedText = this.mergeSplits(goodSplits, _separator)
          finalChunks.push(...mergedText)
          goodSplits = []
        }
        if (!newSeparators) {
          finalChunks.push(s)
        } else {
          const otherInfo = this._splitText(s, newSeparators)
          finalChunks.push(...otherInfo)
        }
      }
    }

    if (goodSplits.length) {
      const mergedText = this.mergeSplits(goodSplits, _separator)
      finalChunks.push(...mergedText)
    }

    return finalChunks
  }

  splitText(text: string): string[] {
    return this._splitText(text, this.separators)
  }

  static fromLanguage(language: SupportedTextSplitterLanguage, options?: Partial<RecursiveCharacterTextSplitterParams>) {
    return new RecursiveCharacterTextSplitter({ ...options, separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage(language) })
  }

  static getSeparatorsForLanguage(language: SupportedTextSplitterLanguage) {

    if (language === "markdown") {
      return [
        // First, try to split along Markdown headings (starting with level 2)
        "\n## ",
        "\n### ",
        "\n#### ",
        "\n##### ",
        "\n###### ",
        // Note the alternative syntax for headings (below) is not handled here
        // Heading level 2
        // ---------------
        // End of code block
        "```\n\n",
        // Horizontal lines
        "\n\n***\n\n",
        "\n\n---\n\n",
        "\n\n___\n\n",
        // Note that this splitter doesn't handle horizontal lines defined
        // by *three or more* of ***, ---, or ___, but this is not handled
        "\n\n",
        "\n",
        " ",
        "",
      ]
    } else if (language === "html") {
      return [
        // First, try to split along HTML tags
        "<body>",
        "<div>",
        "<p>",
        "<br>",
        "<li>",
        "<h1>",
        "<h2>",
        "<h3>",
        "<h4>",
        "<h5>",
        "<h6>",
        "<span>",
        "<table>",
        "<tr>",
        "<td>",
        "<th>",
        "<ul>",
        "<ol>",
        "<header>",
        "<footer>",
        "<nav>",
        // Head
        "<head>",
        "<style>",
        "<script>",
        "<meta>",
        "<title>",
        // Normal type of lines
        " ",
        "",
      ]
    }
  }
}

type MarkdownTextSplitterParams = TextSplitterParams

export class MarkdownTextSplitter
  extends RecursiveCharacterTextSplitter
  implements MarkdownTextSplitterParams {
  constructor(fields?: Partial<MarkdownTextSplitterParams>) {
    super({
      ...fields,
      separators: RecursiveCharacterTextSplitter.getSeparatorsForLanguage("markdown"),
    })
  }
}

