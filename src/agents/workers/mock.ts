declare global {
  interface DisplayWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    },
  }
}

function create(agent: Agent) {

  return agent.initializeWorker(
    { type: "mock" },
    [
      { type: "unknown", direction: "input", title: "Input", name: "input" },
      { type: "unknown", direction: "output", title: "Ouput", name: "output" },
    ],
    mock
  )

}

async function execute(worker: AIWorker, { debug }: AgentParameters) {
  if (!debug) worker.fields.output.value = worker.fields.input.value
}

export const mock: WorkerRegistryItem = {
  title: "Mock Data",
  execute,
  create,
  get registry() { return mock },
}

