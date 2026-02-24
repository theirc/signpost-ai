
declare global {
  interface TextWorker extends AIWorker {
    fields: {
      output: NodeIO
      // condition: NodeIO
    },
    parameters: {
      text?: string
      contentType?: "text" | "number" | "audio" | "image" | "file" | "Timestamp" | "boolean"
      contentUri?: string
      numberValue?: number
      booleanValue?: boolean
    }
  }
}

async function execute(worker: TextWorker) {
  const { contentType, text, contentUri, numberValue, booleanValue } = worker.parameters

  switch (contentType) {
    case "number":
      worker.fields.output.value = numberValue !== undefined ? numberValue : 0
      break
    case "boolean":
      worker.fields.output.value = booleanValue !== undefined ? booleanValue : false
      break
    case "audio":
    case "image":
    case "file":
      worker.fields.output.value = contentUri || ""
      break
    case "Timestamp":
      worker.fields.output.value = new Date()
      break
    case "text":
    default:
      worker.fields.output.value = text || ""
      break
  }
}

export const text: WorkerRegistryItem = {
  title: "Content",
  execute,
  category: "generator",
  type: "text",
  description: "This worker generates static content (text, numbers, audio, images, files)",
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "text",
        conditionable: true,
        parameters: {
          contentType: "text",
        },
      },
      [
        { type: "string", direction: "output", title: "Output", name: "output" },
        // { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      ],
      text
    )
  },
  get registry() { return text },
}
