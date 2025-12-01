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

import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'
import { marked } from 'marked'

import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from 'docx'

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

async function generatePdf(content: string): Promise<Uint8Array> {
  const html = marked(content)
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">

      <style>
        body { 
          font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; 
          line-height: 1.6; 
          margin: 0;
          padding: 40px;
          color: #333;
          background: white;
          max-width: 800px;
          margin: 0 auto;
        }
        h1, h2, h3, h4, h5, h6 { 
          color: #2c3e50; 
          margin-top: 30px;
          margin-bottom: 15px;
          font-weight: 600;
        }
        h1 { 
          font-size: 28px; 
          border-bottom: 2px solid #3498db;
          padding-bottom: 10px;
        }
        h2 { 
          font-size: 24px; 
          border-bottom: 1px solid #bdc3c7;
          padding-bottom: 8px;
        }
        h3 { 
          font-size: 20px; 
          color: #34495e;
        }
        p { 
          margin-bottom: 16px; 
          text-align: justify;
        }
        strong { 
          font-weight: 600; 
          color: #2c3e50;
        }
        em { 
          font-style: italic; 
          color: #7f8c8d;
        }
        code { 
          background-color: #f8f9fa; 
          padding: 3px 6px; 
          border-radius: 4px; 
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          font-size: 14px;
          border: 1px solid #e9ecef;
        }
        pre { 
          background-color: #f8f9fa; 
          padding: 16px; 
          border-radius: 6px; 
          overflow-x: auto; 
          font-family: 'Consolas', 'Monaco', 'Courier New', monospace;
          border: 1px solid #e9ecef;
          margin: 20px 0;
        }
        blockquote { 
          border-left: 4px solid #3498db; 
          padding-left: 20px; 
          margin: 20px 0; 
          font-style: italic;
          background-color: #f8f9fa;
          padding: 15px;
          border-radius: 0 6px 6px 0;
        }
        ul, ol { 
          padding-left: 25px; 
          margin: 16px 0;
        }
        li { 
          margin-bottom: 8px;
        }
        hr { 
          border: none;
          border-top: 2px solid #bdc3c7;
          margin: 30px 0;
        }
        a { 
          color: #3498db;
          text-decoration: none;
        }
        a:hover { 
          text-decoration: underline;
        }

      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `

  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = fullHtml
  const s = tempDiv.style
  s.position = 'absolute'
  s.left = '-9999px'
  s.top = '-9999px'
  s.width = '800px'
  s.background = 'white'
  s.boxShadow = '0 0 10px rgba(0,0,0,0.1)'
  document.body.appendChild(tempDiv)

  try {
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      width: 800,
      height: tempDiv.scrollHeight
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    const imgWidth = 160
    const pageHeight = 297
    const topMargin = 25
    const bottomMargin = 30
    const usablePageHeight = pageHeight - topMargin - bottomMargin
    
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    if (imgHeight <= usablePageHeight) {
      const availableHeight = pageHeight - topMargin - bottomMargin
      const verticalOffset = (availableHeight - imgHeight) / 2 + topMargin
      pdf.addImage(imgData, 'PNG', 25, verticalOffset, imgWidth, imgHeight)
    } else {
      const totalPages = Math.ceil(imgHeight / usablePageHeight)
      
      const firstPageHeight = Math.min(usablePageHeight, imgHeight)
      
      const firstPageCanvas = document.createElement('canvas')
      const firstCtx = firstPageCanvas.getContext('2d')
      firstPageCanvas.width = canvas.width
      firstPageCanvas.height = firstPageHeight * (canvas.width / imgWidth)
      
      firstCtx?.drawImage(
        canvas,
        0, 0,
        canvas.width, firstPageHeight * (canvas.width / imgWidth),
        0, 0,
        firstPageCanvas.width, firstPageCanvas.height
      )
      
      const firstPageImgData = firstPageCanvas.toDataURL('image/png')
      pdf.addImage(firstPageImgData, 'PNG', 25, topMargin, imgWidth, firstPageHeight)
      
      if (totalPages > 1) {
        for (let pageNum = 1; pageNum < totalPages; pageNum++) {
          const pageStartY = pageNum * usablePageHeight
          const pageHeight = Math.min(usablePageHeight, imgHeight - pageStartY)
          
          const pageCanvas = document.createElement('canvas')
          const pageCtx = pageCanvas.getContext('2d')
          pageCanvas.width = canvas.width
          pageCanvas.height = pageHeight * (canvas.width / imgWidth)
          
          pageCtx?.drawImage(
            canvas,
            0, pageStartY * (canvas.width / imgWidth),
            canvas.width, pageHeight * (canvas.width / imgWidth),
            0, 0,
            pageCanvas.width, pageCanvas.height
          )
          
          const pageImgData = pageCanvas.toDataURL('image/png')
          
          pdf.addPage()
          pdf.addImage(pageImgData, 'PNG', 25, topMargin, imgWidth, pageHeight)
        }
      }
    }

    const pdfArrayBuffer = pdf.output('arraybuffer')
    return new Uint8Array(pdfArrayBuffer)
  } finally {
    document.body.removeChild(tempDiv)
  }
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
  
  const blob = await Packer.toBlob(doc)
  const arrayBuffer = await blob.arrayBuffer()
  return new Uint8Array(arrayBuffer)
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
    const { buffer, mimeType, filename } = fileData;
    
    // Import supabase (dynamic import to handle different environments)
    const { supabase } = await import('../db');
    
    // Create a unique filename for temporary storage
    const tempFileName = `temp-documents/${Date.now()}-${Math.random().toString(36).substring(7)}-${filename}`;
    
    // Convert buffer to File/Blob for upload
    const fileBlob = new Blob([new Uint8Array(buffer)], { type: mimeType });
    
    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('documents')
      .upload(tempFileName, fileBlob, {
        cacheControl: '300', // Cache for 5 minutes
        upsert: false // Don't overwrite, each upload should be unique
      });

    if (uploadError) {
      console.error('Supabase upload error:', uploadError);
      return null;
    }

    // Create signed URL that expires in 5 minutes
    const { data: signedUrlData, error: signedUrlError } = await supabase.storage
      .from('documents')
      .createSignedUrl(uploadData.path, 300);

    if (signedUrlError) {
      console.error('Signed URL creation error:', signedUrlError);
      return null;
    }

    console.log(`Temporary document uploaded: ${tempFileName}, expires in 5 minutes`);
    
    // Schedule cleanup after 6 minutes (1 minute buffer)
    setTimeout(async () => {
      try {
        await supabase.storage.from('documents').remove([uploadData.path]);
        console.log(`Cleaned up temporary document: ${tempFileName}`);
      } catch (cleanupError) {
        console.error('Error cleaning up temporary document:', cleanupError);
      }
    }, 360000); // 6 minutes

    return signedUrlData.signedUrl;

  } catch (error) {
    console.error('Error uploading document:', error);
    return null;
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
