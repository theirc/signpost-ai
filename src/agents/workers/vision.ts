import OpenAI from "openai"

declare global {
  interface VisionWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
    parameters: {
      model?: string
      prompt?: string
    }
  }
}

const defaultPrompt = `
Analyze this images and provide a comprehensive description. Describe what you see in detail. 
The main purpose of this is to summarize details of images for teachers, so pay close attention to fully describing any written content you might see and if you notice any errors in written work point them out. 
Always return the images description and nothing else.
If there is more than one image, describe each one with a line separator.
`

const supportedFormats = ["png", "jpeg", "jpg", "webp"]

async function execute(worker: VisionWorker, { apiKeys }: AgentParameters) {

  const input = (worker.fields.input.value || "").trim()
  const modelParam = worker.parameters.model || "openai/gpt-4o"
  const prompt = worker.parameters.prompt || defaultPrompt
  worker.fields.output.value = ""

  const selModel = modelParam.split("/")
  const model = selModel[1]

  if (!input) return

  const apiKey = apiKeys["openai"]

  if (!apiKey) {
    worker.error = `No OpenAI API key found`
    return
  }

  const urlRegex = /https?:\/\/[^\s"'<>]+/gi
  const allUrls = input.match(urlRegex) || []
  const urlList = allUrls.filter(url => {
    const clean = url.split("?")[0].split("#")[0]
    const ext = clean.split(".").pop()?.toLowerCase()
    return ext && supportedFormats.includes(ext)
  })

  if (urlList.length === 0) return

  const client = new OpenAI({ apiKey, dangerouslyAllowBrowser: true })

  const imageList = urlList.map(url => ({
    type: 'image_url',
    image_url: {
      url,
    },
  }))

  const response = await client.chat.completions.create({
    model,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: prompt,
          },
          ...imageList
        ],
      },
    ],
    max_tokens: 1000,
  })


  worker.fields.output.value = response.choices[0].message.content

}

export const vision: WorkerRegistryItem = {
  title: "Vision",
  category: "generator",
  type: "vision",
  description: "Converts image URLs into text descriptions using AI vision models.",
  execute,
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "vision",
        parameters: {
          model: "openai/gpt-4o",
          prompt: defaultPrompt,
        }
      },
      [
        { type: "string", direction: "input", title: "Input", name: "input" },
        { type: "string", direction: "output", title: "Output", name: "output" },
      ],
      vision
    )
  },
  get registry() { return vision },
}
