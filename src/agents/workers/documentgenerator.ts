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

import { jsPDF } from 'jspdf'
import { marked, type Token } from 'marked'
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

interface PdfSegment {
  text: string
  font: string
  style: string
  size: number
}

interface PdfLayout {
  pdf: jsPDF
  y: number
  maxY: number
  contentWidth: number
}

const PDF_HEADING_SIZES = [22, 18, 15, 13, 11, 10] as const
const PDF_BODY = 10
const PDF_CODE = 9
const PDF_LH = 1.5
const PDF_PT_MM = 0.352778
const PDF_M = { top: 20, left: 20, right: 20, bottom: 20 }

function pdfLh(fs: number): number {
  return fs * PDF_LH * PDF_PT_MM
}

function pdfStyle(bold: boolean, italic: boolean): string {
  if (bold && italic) return 'bolditalic'
  if (bold) return 'bold'
  if (italic) return 'italic'
  return 'normal'
}

function pdfDecodeEntities(text: string): string {
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/&emsp;/g, '    ')
    .replace(/&ensp;/g, '  ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&thinsp;/g, ' ')
    .replace(/&mdash;/g, '--')
    .replace(/&ndash;/g, '-')
    .replace(/&hellip;/g, '...')
    .replace(/&bull;/g, '-')
    .replace(/&rarr;/g, '->')
    .replace(/&larr;/g, '<-')
    .replace(/&copy;/g, '(c)')
    .replace(/&reg;/g, '(R)')
    .replace(/&trade;/g, '(TM)')
    .replace(/&deg;/g, ' deg')
    .replace(/&[a-zA-Z]+;/g, ' ')
    .replace(/&#(\d+);/g, (_, c) => {
      const n = Number(c)
      return (n >= 0x20 && n <= 0x7E) || (n >= 0xA0 && n <= 0xFF) ? String.fromCharCode(n) : ''
    })
    .replace(/&#x([0-9a-fA-F]+);/g, (_, h) => {
      const n = parseInt(h, 16)
      return (n >= 0x20 && n <= 0x7E) || (n >= 0xA0 && n <= 0xFF) ? String.fromCharCode(n) : ''
    })
}

function pdfStripUnicode(text: string): string {
  return text
    .replace(/[\u2192\u2794\u27A1]/g, '->')
    .replace(/\u2190/g, '<-')
    .replace(/\u2194/g, '<->')
    .replace(/[\u2080-\u2089]/g, ch => String(ch.charCodeAt(0) - 0x2080))
    .replace(/\u00B2/g, '2')
    .replace(/\u00B3/g, '3')
    .replace(/\u00B9/g, '1')
    .replace(/[\u2074-\u2079]/g, ch => String(ch.charCodeAt(0) - 0x2070))
    .replace(
      /[^\t\n\r\x20-\x7E\xA0-\xFF\u2018\u2019\u201C\u201D\u2022\u2013\u2014\u2026\u20AC]/gu,
      ''
    )
}

function pdfPreClean(md: string): string {
  let r = md
  r = r.replace(/<!--[\s\S]*?-->/g, '')
  r = r.replace(/<br\s*\/?>/gi, '\n')
  r = r.replace(/<[^>]+>/g, '')
  r = pdfDecodeEntities(r)
  r = pdfStripUnicode(r)
  return r
}

function pdfClean(text: string): string {
  let r = text
  r = r.replace(/<!--[\s\S]*?-->/g, '')
  r = r.replace(/<br\s*\/?>/gi, '\n')
  r = r.replace(/<[^>]+>/g, '')
  r = pdfDecodeEntities(r)
  r = pdfStripUnicode(r)
  return r
}

function pdfFlatten(tokens: Token[], bold = false, italic = false, sz = PDF_BODY): PdfSegment[] {
  const out: PdfSegment[] = []
  for (const t of tokens) {
    switch (t.type) {
      case 'text':
        if (t.tokens && t.tokens.length > 0) {
          out.push(...pdfFlatten(t.tokens, bold, italic, sz))
        } else {
          out.push({ text: pdfClean(t.text), font: 'helvetica', style: pdfStyle(bold, italic), size: sz })
        }
        break
      case 'strong':
        out.push(...pdfFlatten(t.tokens, true, italic, sz))
        break
      case 'em':
        out.push(...pdfFlatten(t.tokens, bold, true, sz))
        break
      case 'codespan':
        out.push({ text: pdfClean(t.text), font: 'courier', style: 'normal', size: PDF_CODE })
        break
      case 'link':
        out.push(...pdfFlatten(t.tokens, bold, italic, sz))
        break
      case 'br':
        out.push({ text: '\n', font: 'helvetica', style: 'normal', size: sz })
        break
      default:
        if ('tokens' in t && Array.isArray(t.tokens)) {
          out.push(...pdfFlatten(t.tokens as Token[], bold, italic, sz))
        } else if ('text' in t && typeof t.text === 'string') {
          out.push({ text: pdfClean(t.text), font: 'helvetica', style: pdfStyle(bold, italic), size: sz })
        }
    }
  }
  return out
}

function pdfEnsure(s: PdfLayout, h: number): void {
  if (s.y + h > s.maxY) {
    s.pdf.addPage()
    s.y = PDF_M.top
  }
}

function pdfDrawSegs(s: PdfLayout, segs: PdfSegment[], indent = 0): void {
  const sx = PDF_M.left + indent
  const mx = PDF_M.left + s.contentWidth
  let x = sx

  for (const seg of segs) {
    s.pdf.setFont(seg.font, seg.style)
    s.pdf.setFontSize(seg.size)
    const h = pdfLh(seg.size)

    const lines = pdfClean(seg.text).split('\n')
    for (let li = 0; li < lines.length; li++) {
      if (li > 0) {
        s.y += h
        pdfEnsure(s, h)
        x = sx
      }
      const words = lines[li].split(/( +)/).filter(Boolean)
      for (const word of words) {
        const w = s.pdf.getTextWidth(word)
        if (x + w > mx && x > sx) {
          s.y += h
          pdfEnsure(s, h)
          x = sx
          if (!word.trim()) continue
        }
        s.pdf.text(word, x, s.y)
        x += w
      }
    }
  }

  const lastSz = segs.length > 0 ? segs[segs.length - 1].size : PDF_BODY
  s.y += pdfLh(lastSz)
}

function pdfRenderBlocks(s: PdfLayout, tokens: Token[]): void {
  for (const token of tokens) {
    switch (token.type) {
      case 'heading': {
        const fs = PDF_HEADING_SIZES[token.depth - 1] ?? 10
        const h = pdfLh(fs)
        s.y += 3
        pdfEnsure(s, h + 4)
        pdfDrawSegs(s, pdfFlatten(token.tokens, true, false, fs))
        if (token.depth <= 2) {
          s.pdf.setDrawColor(189, 195, 199)
          s.pdf.setLineWidth(token.depth === 1 ? 0.5 : 0.3)
          s.pdf.line(PDF_M.left, s.y - 1, PDF_M.left + s.contentWidth, s.y - 1)
          s.y += 2
        }
        s.y += 1
        break
      }

      case 'html': {
        break
      }

      case 'paragraph': {
        pdfEnsure(s, pdfLh(PDF_BODY))
        pdfDrawSegs(s, pdfFlatten(token.tokens))
        s.y += 2
        break
      }

      case 'list': {
        for (let i = 0; i < token.items.length; i++) {
          const item = token.items[i]
          pdfEnsure(s, pdfLh(PDF_BODY))
          s.pdf.setFont('helvetica', 'normal')
          s.pdf.setFontSize(PDF_BODY)
          const startNum = typeof token.start === 'number' ? token.start : 1
          const marker = token.ordered ? `${startNum + i}.` : '\u2022'
          s.pdf.text(marker, PDF_M.left, s.y)

          for (const sub of item.tokens) {
            if ('tokens' in sub && Array.isArray(sub.tokens)) {
              pdfDrawSegs(s, pdfFlatten(sub.tokens as Token[]), 8)
            } else if ('text' in sub && typeof sub.text === 'string') {
              pdfDrawSegs(s, [{ text: pdfClean(sub.text), font: 'helvetica', style: 'normal', size: PDF_BODY }], 8)
            }
          }
        }
        s.y += 2
        break
      }

      case 'code': {
        const h = pdfLh(PDF_CODE)
        const codeLines = pdfClean(token.text).split('\n')
        const blockH = codeLines.length * h + 6
        pdfEnsure(s, Math.min(blockH, 40))
        s.pdf.setFillColor(248, 249, 250)
        s.pdf.setDrawColor(233, 236, 239)
        s.pdf.roundedRect(PDF_M.left, s.y - 3, s.contentWidth, blockH, 1, 1, 'FD')
        s.y += 1
        s.pdf.setFont('courier', 'normal')
        s.pdf.setFontSize(PDF_CODE)
        s.pdf.setTextColor(51, 51, 51)
        for (const codeLine of codeLines) {
          pdfEnsure(s, h)
          s.pdf.text(codeLine.substring(0, 120), PDF_M.left + 3, s.y)
          s.y += h
        }
        s.pdf.setTextColor(0, 0, 0)
        s.y += 4
        break
      }

      case 'blockquote': {
        const startY = s.y
        s.pdf.setTextColor(85, 85, 85)
        for (const sub of token.tokens) {
          if (sub.type === 'paragraph' && sub.tokens) {
            pdfDrawSegs(s, pdfFlatten(sub.tokens, false, true), 6)
          }
        }
        s.pdf.setTextColor(0, 0, 0)
        s.pdf.setDrawColor(52, 152, 219)
        s.pdf.setLineWidth(1)
        s.pdf.line(PDF_M.left + 2, startY - 3, PDF_M.left + 2, s.y - 1)
        s.y += 2
        break
      }

      case 'hr': {
        pdfEnsure(s, 6)
        s.y += 3
        s.pdf.setDrawColor(189, 195, 199)
        s.pdf.setLineWidth(0.3)
        s.pdf.line(PDF_M.left, s.y, PDF_M.left + s.contentWidth, s.y)
        s.y += 3
        break
      }

      case 'space': {
        s.y += 3
        break
      }

      case 'table': {
        const cols = token.header.length
        if (cols === 0) break
        const colWidth = s.contentWidth / cols
        const h = pdfLh(PDF_BODY)
        pdfEnsure(s, h * 2)
        s.pdf.setFont('helvetica', 'bold')
        s.pdf.setFontSize(PDF_BODY)
        s.pdf.setFillColor(240, 240, 240)
        s.pdf.rect(PDF_M.left, s.y - 3, s.contentWidth, h + 2, 'F')
        for (let c = 0; c < cols; c++) {
          s.pdf.text(pdfClean(token.header[c].text).substring(0, 30), PDF_M.left + c * colWidth + 2, s.y)
        }
        s.y += h + 1
        s.pdf.setFont('helvetica', 'normal')
        for (const row of token.rows) {
          pdfEnsure(s, h)
          for (let c = 0; c < Math.min(row.length, cols); c++) {
            s.pdf.text(pdfClean(row[c].text).substring(0, 30), PDF_M.left + c * colWidth + 2, s.y)
          }
          s.y += h
        }
        s.y += 3
        break
      }

      default: {
        if ('text' in token && typeof token.text === 'string') {
          const h = pdfLh(PDF_BODY)
          pdfEnsure(s, h)
          s.pdf.setFont('helvetica', 'normal')
          s.pdf.setFontSize(PDF_BODY)
          const wrapped: string[] = s.pdf.splitTextToSize(pdfClean(token.text), s.contentWidth)
          for (const line of wrapped) {
            pdfEnsure(s, h)
            s.pdf.text(line, PDF_M.left, s.y)
            s.y += h
          }
          s.y += 2
        }
      }
    }
  }
}

async function generatePdf(content: string): Promise<Uint8Array> {
  const pdf = new jsPDF({ unit: 'mm', format: 'a4' })
  const pw = pdf.internal.pageSize.getWidth()
  const ph = pdf.internal.pageSize.getHeight()

  const state: PdfLayout = {
    pdf,
    y: PDF_M.top,
    maxY: ph - PDF_M.bottom,
    contentWidth: pw - PDF_M.left - PDF_M.right,
  }

  const tokens = marked.lexer(pdfPreClean(content))
  pdfRenderBlocks(state, tokens)

  return new Uint8Array(pdf.output('arraybuffer'))
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
