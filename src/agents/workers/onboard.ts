
declare global {
  interface OnboardWorker extends AIWorker {
    fields: {
      input: NodeIO
      value: NodeIO
    }
    parameters: {
      name?: string
      question?: string
    }
  }
}

function create(agent: Agent) {
  return agent.initializeWorker(
    {
      type: "onboard",
      parameters: {
        name: "",
        question: "",
      },
      conditionable: true,
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "string", direction: "output", title: "Value", name: "value", system: true },
    ],
    onboard
  )
}

async function execute(worker: OnboardWorker, p: AgentParameters) {
  const handlers = worker.getUserHandlers()
  const input = worker.fields.input.value


}

export const onboard: WorkerRegistryItem = {
  title: "Onboard",
  category: "tool",
  type: "onboard",
  description: "This worker extracts onboarding information from input text and structures it into defined fields.",
  execute,
  create,
  get registry() { return onboard },
}
