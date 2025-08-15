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

import { marked } from 'marked'
import jsPDF from 'jspdf'
import html2canvas from 'html2canvas'

async function convertMarkdownToPdf(markdown: string): Promise<Uint8Array> {
  const html = marked(markdown)
  
  const fullHtml = `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <style>
        body { 
          font-family: Arial, sans-serif; 
          line-height: 1.6; 
          margin: 40px; 
          color: #333;
          background: white;
        }
        h1, h2, h3, h4, h5, h6 { 
          color: #333; 
          margin-top: 20px;
          margin-bottom: 10px;
        }
        h1 { font-size: 24px; }
        h2 { font-size: 20px; }
        h3 { font-size: 18px; }
        code { 
          background-color: #f4f4f4; 
          padding: 2px 4px; 
          border-radius: 3px; 
          font-family: 'Courier New', monospace;
        }
        pre { 
          background-color: #f4f4f4; 
          padding: 10px; 
          border-radius: 5px; 
          overflow-x: auto; 
          font-family: 'Courier New', monospace;
        }
        blockquote { 
          border-left: 4px solid #ddd; 
          padding-left: 15px; 
          margin-left: 0; 
          font-style: italic;
        }
        ul, ol { 
          padding-left: 20px; 
        }
        p { margin-bottom: 10px; }
      </style>
    </head>
    <body>
      ${html}
    </body>
    </html>
  `

  // Create a temporary div to render the HTML
  const tempDiv = document.createElement('div')
  tempDiv.innerHTML = fullHtml
  tempDiv.style.position = 'absolute'
  tempDiv.style.left = '-9999px'
  tempDiv.style.top = '-9999px'
  tempDiv.style.width = '800px'
  tempDiv.style.background = 'white'
  document.body.appendChild(tempDiv)

  try {
    const canvas = await html2canvas(tempDiv, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff'
    })

    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF('p', 'mm', 'a4')
    
    const imgWidth = 210
    const pageHeight = 295
    const imgHeight = (canvas.height * imgWidth) / canvas.width
    let heightLeft = imgHeight

    let position = 0

    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
    heightLeft -= pageHeight

    while (heightLeft >= 0) {
      position = heightLeft - imgHeight
      pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight)
      heightLeft -= pageHeight
    }

    const pdfArrayBuffer = pdf.output('arraybuffer')
    return new Uint8Array(pdfArrayBuffer)
  } finally {
    document.body.removeChild(tempDiv)
  }
}

async function convertMarkdownToDocx(markdown: string): Promise<Uint8Array> {
  const textContent = markdown.replace(/[#*`]/g, '')
  const docxText = `DOCX Content:\n\n${textContent}`
  
  const encoder = new TextEncoder()
  return encoder.encode(docxText)
}

async function convertToFile(markdown: string, type: string): Promise<Uint8Array> {
  if (type === "pdf") {
    return await convertMarkdownToPdf(markdown)
  } else {
    return await convertMarkdownToDocx(markdown)
  }
}

async function execute(worker: AIWorker) {
  const inputValue = worker.fields.input.value
  const docType = worker.parameters.doc || "docx"
  
  if (inputValue) {
    try {
      const filename = `generated.${docType === "pdf" ? "pdf" : "docx"}`
      
      const buffer = await convertToFile(inputValue, docType)
      
      worker.fields.output.value = {
        content: inputValue,
        type: docType,
        filename: filename,
        buffer: buffer,
        mimeType: docType === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
      }
    } catch (error) {
      console.error('Document generation error:', error)
      worker.fields.output.value = {
        error: `Failed to generate ${docType}: ${error.message}`,
        type: docType,
        filename: `error.${docType === "pdf" ? "pdf" : "docx"}`
      }
    }
  }
}

export const documentGenerator: WorkerRegistryItem = {
  title: "Document Generator",
  execute,
  category: "tool",
  type: "documentGenerator",
  description: "Generates documents (DOC or PDF) from text input.",
  create(agent: Agent) {
    return agent.initializeWorker(
      { type: "documentGenerator" },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "file", direction: "output", title: "Output", name: "output" },
      ],
      documentGenerator,
      { doc: "docx" }
    )
  },
  get registry() { return documentGenerator },
}
