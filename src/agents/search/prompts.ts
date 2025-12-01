
export const contentPdfExtractionPrompt = `
You will receive a file in PDF, DOC, or DOCX format.

These documents may contain:
- native digital text
- text mixed with images
- pages that are fully rendered as images (e.g., scanned or JPG-based pages)
- tables, diagrams, charts, and other visuals

Your task is to analyze the entire document and produce structured data optimized for Retrieval-Augmented Generation (RAG).

Follow these rules strictly:

1. AUTO-DETECT PAGE CONTENT
   - For each page, automatically determine whether it contains:
       a) extractable digital text,
       b) mixed content (text + images),
       c) or is entirely an image.
   - If a page is partially or fully an image:
       → Perform robust OCR.
       → Extract all readable text from the image.
   - Merge OCR text seamlessly with normal extracted text.

2. FULL EXTRACTION → CLEAN MARKDOWN
   - Convert all extracted content into normalized Markdown.
   - Preserve semantic structure: headings, lists, tables, quotes, code blocks.
   - For images, diagrams, and visuals:
       Insert:
       ![Description](image-placeholder)
       followed by a concise bullet list describing the visual.

3. OCR CLEANUP
   - Remove OCR artifacts: broken words, hyphens, duplicated segments, odd spacing.

4. LOCALE DETECTION
   - Identify the primary locale/language of the document using all extracted text (including OCR output).

5. CHUNK GENERATION
   - Split the final Markdown into semantically meaningful chunks of ~800–1200 characters.
   - Each chunk must be self-contained and contain only Markdown.

6. REMOVE NOISE
   - Remove headers, footers, page numbers, repeated titles, scanning artifacts, and irrelevant content.

7. OUTPUT FORMAT
   - Respond strictly using the schema provided.
   - Produce no commentary, no analysis, and no meta text outside the structured output.
`



export const _contentPdfExtractionPrompt = `

You will be given a PDF file. Read and interpret all of its content, including text, images, diagrams, tables, charts, and other visual or structural elements.

Your task is to produce a clean, well-structured Markdown document optimized for Retrieval Augmented Generation (RAG).

Follow these rules strictly:

1. Output only the processed Markdown content.
   - No explanations.
   - No commentary.
   - No questions.
   - No meta text about the file, the process, or the instructions.

2. Extract and rewrite all textual content faithfully, preserving meaning and structure.

3. For every image, diagram, chart, or visual element:
   - Insert a Markdown image placeholder:  
     '![Description](image - placeholder)'
   - Immediately after, provide a bullet list describing what the visual element shows in clear, concise detail.

4. Convert tables into Markdown tables when possible.
   - If a table cannot be reproduced, summarize its contents clearly.

5. Preserve and structure the document logically:
   - Use headings ('#', '##', '###', ...)
   - Maintain lists, numbered steps, quotes, code blocks, formulas, and any semantic structure.

6. Remove irrelevant elements:
   - page numbers
   - headers/footers
   - repeated section titles
   - artifacts from PDF conversion

7. Normalize whitespace and ensure the final Markdown is clean and ready for embedding in a RAG pipeline.

Produce only the final Markdown document as your output.

`

