
declare global {
  interface HandoffAgentWorker extends AIWorker {
    parameters: {
      handoffDescription?: string
      model?: string
    }
    fields: {
      instructions: NodeIO
      handoff?: NodeIO
    }
    state: {
      context: any
      history: any[]
    }
  }
}

async function execute(worker: HandoffAgentWorker) {
  //nada
}

export const handoffAgent: WorkerRegistryItem = {
  title: "Handoff",
  execute,
  category: "generator",
  type: "handoffAgent",
  description: "Specialized agent worker for handling handoffs and routing.",
  create(agent: Agent) {
    return agent.initializeWorker(
      {
        type: "handoffAgent",
        conditionable: true,
        parameters: {
          model: "openai/gpt-4.1",
        },
        state: {
          context: {},
          history: [],
        }
      },
      [
        { type: "string", direction: "input", title: "Instructions", name: "instructions" },
        { type: "handoff", direction: "input", title: "Handoffs", name: "handoff" },
      ],
      handoffAgent
    )
  },
  get registry() { return handoffAgent },
}
