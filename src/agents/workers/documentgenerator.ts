declare global {
  interface DocumentGeneratorWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
    parameters: {
      doc: string
    }
  }
}

export type { DocumentGeneratorWorker }

// @ts-ignore -- pdfmake ships as CJS; default import matches the runtime instance
import pdfMake from 'pdfmake/build/pdfmake'
// @ts-ignore
import pdfFonts from 'pdfmake/build/vfs_fonts'
import { marked, type Token } from 'marked'

try { (pdfMake as any).vfs = (pdfFonts as any)?.pdfMake?.vfs ?? pdfFonts } catch {}
import { Document, Packer, Paragraph, TextRun, HeadingLevel, convertInchesToTwip } from 'docx'

function extractTitle(content: string): string {
  if (!content) return 'generated'
  const fm = /^---[\s\S]*?\btitle\s*:\s*(.+?)\s*$(?:[\s\S]*?)---/m.exec(content)
  if (fm && fm[1]) return fm[1].trim()
  const lines = content.split(/\r?\n/)
  for (const line of lines) {
    const m = /^(#{1,6})\s+(.*)$/.exec(line.trim())
    if (m && m[2]) return m[2].trim()
  }
  for (const line of lines) {
    const t = line.trim()
    if (!t) continue
    const tv = /^title\s*:\s*(.+)$/i.exec(t)
    if (tv && tv[1]) return tv[1].trim()
  }
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/^```/.test(trimmed)) continue
    return trimmed
  }
  return 'generated'
}

function toSnakeCaseBase(name: string): string {
  const noDiacritics = name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
  const base = noDiacritics
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
  return base || 'generated'
}

function generateCsv(content: string): Uint8Array {
  const lines = content.split('\n').filter(line => line.trim())

  if (lines.length === 0) {
    return new TextEncoder().encode('')
  }

  const csvLines: string[] = []

  for (const line of lines) {
    const trimmedLine = line.trim()
    if (!trimmedLine) continue

    if (trimmedLine.startsWith('|') && trimmedLine.endsWith('|')) {
      const cells = trimmedLine
        .slice(1, -1)
        .split('|')
        .map(cell => cell.trim())
        .map(cell => {
          if (cell.includes(',') || cell.includes('"') || cell.includes('\n')) {
            return `"${cell.replace(/"/g, '""')}"`
          }
          return cell
        })
      csvLines.push(cells.join(','))
    } else if (trimmedLine.startsWith('-')) {
      continue
    } else if (trimmedLine.startsWith('#')) {
      const header = trimmedLine.replace(/^#+\s*/, '').trim()
      csvLines.push(`"${header}"`)
    } else if (trimmedLine.startsWith('- ') || trimmedLine.startsWith('* ')) {
      const item = trimmedLine.replace(/^[-*]\s*/, '').trim()
      csvLines.push(`"${item}"`)
    } else if (trimmedLine.startsWith('> ')) {
      const quote = trimmedLine.replace(/^>\s*/, '').trim()
      csvLines.push(`"${quote}"`)
    } else if (trimmedLine.startsWith('```')) {
      continue
    } else {
      csvLines.push(`"${trimmedLine}"`)
    }
  }

  const csvContent = csvLines.join('\n')
  return new TextEncoder().encode(csvContent)
}

const HEADING_SIZES = [24, 20, 16, 14, 12, 10]
const CONTENT_WIDTH = 515

function cleanMarkdown(md: string): string {
  let r = md
  r = r.replace(/<!--[\s\S]*?-->/g, '')
  r = r.replace(/<br\s*\/?>/gi, '\n')
  r = r.replace(/<[^>]+>/g, '')
  r = r.replace(/&amp;/g, '&')
  r = r.replace(/&lt;/g, '<')
  r = r.replace(/&gt;/g, '>')
  r = r.replace(/&quot;/g, '"')
  r = r.replace(/&#39;|&apos;/g, "'")
  r = r.replace(/&amp;/g, '&')
  r = r.replace(/&emsp;/g, '    ')
  r = r.replace(/&ensp;/g, '  ')
  r = r.replace(/&nbsp;/g, ' ')
  r = r.replace(/&thinsp;/g, ' ')
  r = r.replace(/&mdash;/g, '\u2014')
  r = r.replace(/&ndash;/g, '\u2013')
  r = r.replace(/&hellip;/g, '\u2026')
  r = r.replace(/&bull;/g, '\u2022')
  r = r.replace(/&rarr;/g, '\u2192')
  r = r.replace(/&larr;/g, '\u2190')
  r = r.replace(/&copy;/g, '\u00A9')
  r = r.replace(/&reg;/g, '\u00AE')
  r = r.replace(/&trade;/g, '\u2122')
  r = r.replace(/&deg;/g, '\u00B0')
  r = r.replace(/&[a-zA-Z]+;/g, ' ')
  r = r.replace(/&#(\d+);/g, (_, c) => String.fromCharCode(Number(c)))
  r = r.replace(/&#x([0-9a-fA-F]+);/g, (_, h) => String.fromCharCode(parseInt(h, 16)))
  r = r.replace(/[\uD800-\uDBFF][\uDC00-\uDFFF]/gu, '')
  return r
}

function flattenInline(tokens: Token[]): any[] {
  const result: any[] = []
  for (const t of tokens) {
    switch (t.type) {
      case 'text':
        if (t.tokens && t.tokens.length > 0) {
          result.push(...flattenInline(t.tokens))
        } else {
          result.push({ text: t.text })
        }
        break
      case 'strong':
        result.push(...flattenInline(t.tokens).map((s: any) => ({ ...s, bold: true })))
        break
      case 'em':
        result.push(...flattenInline(t.tokens).map((s: any) => ({ ...s, italics: true })))
        break
      case 'codespan':
        result.push({ text: t.text, fontSize: 9, background: '#f0f0f0', noWrap: true })
        break
      case 'link':
        result.push(...flattenInline(t.tokens).map((s: any) => ({
          ...s, link: t.href, color: '#2980b9', decoration: 'underline',
        })))
        break
      case 'br':
        result.push({ text: '\n' })
        break
      default:
        if ('tokens' in t && Array.isArray(t.tokens)) {
          result.push(...flattenInline(t.tokens as Token[]))
        } else if ('text' in t && typeof t.text === 'string') {
          result.push({ text: t.text })
        }
    }
  }
  return result
}

function tokensToPdfContent(tokens: Token[]): any[] {
  const content: any[] = []
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const fs = HEADING_SIZES[token.depth - 1] ?? 10
        content.push({
          text: flattenInline(token.tokens),
          fontSize: fs,
          bold: true,
          margin: [0, token.depth <= 2 ? 12 : 8, 0, 4] as [number, number, number, number],
        })
        if (token.depth <= 2) {
          content.push({
            canvas: [{
              type: 'line' as const,
              x1: 0, y1: 0,
              x2: CONTENT_WIDTH, y2: 0,
              lineWidth: token.depth === 1 ? 1 : 0.5,
              lineColor: '#bdc3c7',
            }],
            margin: [0, 0, 0, 6] as [number, number, number, number],
          })
        }
        break
      }

      case 'paragraph':
        content.push({
          text: flattenInline(token.tokens),
          margin: [0, 0, 0, 6] as [number, number, number, number],
          lineHeight: 1.4,
        })
        break

      case 'list': {
        const items = token.items.map((item: any) => {
          const parts: any[] = []
          for (const sub of item.tokens) {
            if ('tokens' in sub && Array.isArray(sub.tokens)) {
              parts.push(...flattenInline(sub.tokens as Token[]))
            } else if ('text' in sub && typeof sub.text === 'string') {
              parts.push({ text: sub.text })
            }
          }
          return { text: parts.length > 0 ? parts : [{ text: '' }] }
        })
        if (token.ordered) {
          const start = typeof token.start === 'number' ? token.start : 1
          content.push({ ol: items, start, margin: [0, 0, 0, 6] as [number, number, number, number] })
        } else {
          content.push({ ul: items, margin: [0, 0, 0, 6] as [number, number, number, number] })
        }
        break
      }

      case 'code':
        content.push({
          table: {
            widths: ['*'],
            body: [[{
              text: token.text,
              fontSize: 9,
              color: '#333333',
              preserveLeadingSpaces: true,
            }]],
          },
          layout: {
            hLineWidth: () => 0.5,
            vLineWidth: () => 0.5,
            hLineColor: () => '#e9ecef',
            vLineColor: () => '#e9ecef',
            fillColor: () => '#f8f9fa',
            paddingLeft: () => 6,
            paddingRight: () => 6,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 4, 0, 6] as [number, number, number, number],
        })
        break

      case 'blockquote': {
        const quoteStack: any[] = []
        for (const sub of token.tokens) {
          if (sub.type === 'paragraph' && sub.tokens) {
            quoteStack.push({
              text: flattenInline(sub.tokens),
              italics: true,
              color: '#555555',
              margin: [0, 0, 0, 4] as [number, number, number, number],
            })
          }
        }
        content.push({
          table: {
            widths: ['*'],
            body: [[{ stack: quoteStack }]],
          },
          layout: {
            hLineWidth: () => 0,
            vLineWidth: (i: number) => i === 0 ? 2 : 0,
            vLineColor: () => '#3498db',
            paddingLeft: () => 8,
            paddingRight: () => 4,
            paddingTop: () => 4,
            paddingBottom: () => 4,
          },
          margin: [0, 4, 0, 6] as [number, number, number, number],
        })
        break
      }

      case 'table': {
        if (token.header.length === 0) break
        const headerRow = token.header.map((h: any) => ({
          text: flattenInline(h.tokens || []),
          bold: true,
          fillColor: '#f0f0f0',
        }))
        const bodyRows = token.rows.map((row: any) =>
          row.map((cell: any) => ({
            text: flattenInline(cell.tokens || []),
          }))
        )
        content.push({
          table: {
            headerRows: 1,
            widths: Array(token.header.length).fill('*'),
            body: [headerRow, ...bodyRows],
          },
          layout: 'lightHorizontalLines',
          margin: [0, 4, 0, 6] as [number, number, number, number],
        })
        break
      }

      case 'hr':
        content.push({
          canvas: [{
            type: 'line' as const,
            x1: 0, y1: 0,
            x2: CONTENT_WIDTH, y2: 0,
            lineWidth: 0.5,
            lineColor: '#bdc3c7',
          }],
          margin: [0, 8, 0, 8] as [number, number, number, number],
        })
        break

      case 'html':
      case 'space':
        break

      default:
        if ('text' in token && typeof token.text === 'string') {
          content.push({
            text: token.text,
            margin: [0, 0, 0, 4] as [number, number, number, number],
          })
        }
    }
  }
  return content
}

async function generatePdf(content: string): Promise<Uint8Array> {
  const cleaned = cleanMarkdown(content)
  const tokens = marked.lexer(cleaned)
  const pdfContent = tokensToPdfContent(tokens)

  const docDefinition: any = {
    content: pdfContent,
    defaultStyle: {
      font: 'Roboto',
      fontSize: 10,
      lineHeight: 1.3,
    },
    pageMargins: [40, 40, 40, 40],
  }

  const buffer = await pdfMake.createPdf(docDefinition).getBuffer()
  return new Uint8Array(buffer)
}

async function generateDocx(content: string): Promise<Uint8Array> {
  const lines = content.split('\n')
  const children: any[] = []

  for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
    const line = lines[lineIndex]
    const trimmedLine = line.trim()

    if (!trimmedLine) {
      children.push(new Paragraph({}))
      continue
    }

    const headingMatch = /^(#{1,6})\s+(.+)$/.exec(trimmedLine)
    if (headingMatch) {
      const level = headingMatch[1].length
      const text = headingMatch[2]

      let headingLevel: typeof HeadingLevel[keyof typeof HeadingLevel]
      switch (level) {
        case 1: headingLevel = HeadingLevel.HEADING_1; break
        case 2: headingLevel = HeadingLevel.HEADING_2; break
        case 3: headingLevel = HeadingLevel.HEADING_3; break
        case 4: headingLevel = HeadingLevel.HEADING_4; break
        case 5: headingLevel = HeadingLevel.HEADING_5; break
        case 6: headingLevel = HeadingLevel.HEADING_6; break
        default: headingLevel = HeadingLevel.HEADING_1
      }

      children.push(new Paragraph({
        children: [new TextRun({ text: text, bold: true, size: 24 })],
        heading: headingLevel,
        spacing: { before: 400, after: 200 }
      }))
      continue
    }

    if (/^[-*+]\s+(.+)$/.test(trimmedLine)) {
      const text = trimmedLine.replace(/^[-*+]\s+/, '')
      const textRuns = parseMarkdownText(text)

      children.push(new Paragraph({
        children: textRuns,
        bullet: { level: 0 },
        spacing: { before: 100, after: 100 }
      }))
      continue
    }

    if (/^\d+\.\s+(.+)$/.test(trimmedLine)) {
      const text = trimmedLine.replace(/^\d+\.\s+/, '')

      const textRuns = parseMarkdownText(text)

      children.push(new Paragraph({
        children: textRuns,
        numbering: { reference: 'default-numbering', level: 0 },
        spacing: { before: 100, after: 100 }
      }))
      continue
    }

    if (/^>\s+(.+)$/.test(trimmedLine)) {
      const text = trimmedLine.replace(/^>\s+/, '')

      children.push(new Paragraph({
        children: [new TextRun({ text: text, size: 20, italics: true })],
        spacing: { before: 200, after: 200 },
        indent: { left: 400 },
        border: { left: { color: '#3498db', size: 4, style: 'single' } }
      }))
      continue
    }

    if (trimmedLine.startsWith('```')) {
      continue
    }

    if (trimmedLine.startsWith('```')) {
      continue
    }

    const textRuns = parseMarkdownText(trimmedLine)

    children.push(new Paragraph({
      children: textRuns,
      spacing: { before: 100, after: 100 }
    }))
  }

  const doc = new Document({
    sections: [{
      properties: {
        page: {
          margin: {
            top: convertInchesToTwip(1),
            right: convertInchesToTwip(1),
            bottom: convertInchesToTwip(1),
            left: convertInchesToTwip(1)
          }
        }
      },
      children: children
    }]
  })

  if (typeof globalThis.Blob !== 'undefined') {
    const blob = await Packer.toBlob(doc)
    const arrayBuffer = await blob.arrayBuffer()
    return new Uint8Array(arrayBuffer)
  }
  const buffer = await Packer.toBuffer(doc)
  return new Uint8Array(buffer)
}

function parseMarkdownText(text: string): TextRun[] {
  const textRuns: TextRun[] = []
  let currentText = ''
  let i = 0

  while (i < text.length) {
    if (text.substring(i, i + 2) === '**') {
      if (currentText) {
        textRuns.push(new TextRun({ text: currentText, size: 20 }))
        currentText = ''
      }

      i += 2
      let boldText = ''
      while (i < text.length && text.substring(i, i + 2) !== '**') {
        boldText += text[i]
        i++
      }

      if (i < text.length && text.substring(i, i + 2) === '**') {
        textRuns.push(new TextRun({ text: boldText, bold: true, size: 20 }))
        i += 2
      } else {
        textRuns.push(new TextRun({ text: '**' + boldText, size: 20 }))
      }
      continue
    }

    if (text[i] === '*' && (i === 0 || text[i - 1] !== '*')) {
      if (currentText) {
        textRuns.push(new TextRun({ text: currentText, size: 20 }))
        currentText = ''
      }

      i++
      let italicText = ''
      while (i < text.length && text[i] !== '*') {
        italicText += text[i]
        i++
      }

      if (i < text.length && text[i] === '*') {
        textRuns.push(new TextRun({ text: italicText, italics: true, size: 20 }))
        i++
      } else {
        textRuns.push(new TextRun({ text: '*' + italicText, size: 20 }))
      }
      continue
    }

    if (text[i] === '`') {
      if (currentText) {
        textRuns.push(new TextRun({ text: currentText, size: 20 }))
        currentText = ''
      }

      i++
      let codeText = ''
      while (i < text.length && text[i] !== '`') {
        codeText += text[i]
        i++
      }

      if (i < text.length && text[i] === '`') {
        textRuns.push(new TextRun({
          text: codeText,
          font: 'Consolas',
          size: 18,
          color: '2c3e50'
        }))
        i++
      } else {
        textRuns.push(new TextRun({ text: '`' + codeText, size: 20 }))
      }
      continue
    }

    currentText += text[i]
    i++
  }

  if (currentText) {
    textRuns.push(new TextRun({ text: currentText, size: 20 }))
  }

  return textRuns
}

async function uploadFileTemporarily(fileData: { buffer: Uint8Array, mimeType: string, filename: string }): Promise<string | null> {
  try {
    const { buffer, mimeType, filename } = fileData

    // Import supabase (dynamic import to handle different environments)
    const { supabase } = await import('../db')

    // Create a unique filename for temporary storage
    const tempFileName = `temp-documents/${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`

    // Convert buffer to File/Blob for upload
    const fileBlob = new Blob([new Uint8Array(buffer)], { type: mimeType })

    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('temp')
      .upload(tempFileName, fileBlob, {
        cacheControl: '300',
        upsert: false
      })

    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      return null
    }

    const { data: urlData } = supabase.storage.from('temp').getPublicUrl(uploadData.path)

    return urlData.publicUrl

  } catch (error) {
    console.error('Error uploading document:', error)
    return null
  }
}

async function generateFile(content: string, type: string): Promise<Uint8Array> {
  if (type === 'csv') return generateCsv(content)
  if (type === 'pdf') return await generatePdf(content)
  return await generateDocx(content)
}

async function execute(worker: AIWorker) {
  const inputValue = worker.fields.input.value as string
  const docType = worker.parameters.doc || 'docx'

  if (!inputValue) return

  try {
    const chosenTitle = extractTitle(inputValue)
    const base = toSnakeCaseBase(chosenTitle)
    const ext = docType === 'pdf' ? 'pdf' : docType === 'csv' ? 'csv' : 'docx'
    const filename = `${base}.${ext}`

    const buffer = await generateFile(inputValue, docType)

    let mimeType: string
    switch (docType) {
      case 'pdf':
        mimeType = 'application/pdf'
        break
      case 'csv':
        mimeType = 'text/csv'
        break
      default:
        mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    }

    // Upload to temporary storage and get URL
    const fileUrl = await uploadFileTemporarily({
      buffer,
      mimeType,
      filename
    })

    if (!fileUrl) {
      worker.fields.output.value = `Error: Failed to upload generated ${docType} file`
      return
    }

    // Return URL string like text worker does
    worker.fields.output.value = fileUrl
  } catch (error) {
    console.error('Document generation error:', error)
    worker.fields.output.value = `Error: Failed to generate ${docType}: ${error.message}`
  }
}

export const documentGenerator: WorkerRegistryItem = {
  title: 'Document Generator',
  execute,
  category: 'tool',
  type: 'documentGenerator',
  description: 'Generates documents (DOCX, PDF, or CSV) from AI worker input.',
  create(agent: Agent) {
    return agent.initializeWorker(
      { type: 'documentGenerator' },
      [
        { type: 'string', direction: 'input', title: 'AI Input', name: 'input' },
        { type: 'file', direction: 'output', title: 'Generated File URL', name: 'output' },
      ],
      documentGenerator,
      { doc: 'docx' }
    )
  },
  get registry() { return documentGenerator },
}
