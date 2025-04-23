
declare global {
  interface TextWorker extends AIWorker {
    fields: {
      output: NodeIO
      condition: NodeIO
    },
    parameters: {
      text?: string
    }
  }
}

async function execute(worker: TextWorker) {
  worker.fields.output.value = worker.parameters.text || ""
}

export const text: WorkerRegistryItem = {
  title: "Text",
  execute,
  category: "generator",
  type: "text",
  description: "This worker generates static text",
  create(agent: Agent) {

    return agent.initializeWorker(
      { type: "text" },
      [
        { type: "string", direction: "output", title: "Output", name: "output" },
        { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      ],
      text
    )

  },
  get registry() { return text },
}

