
interface InputWorker extends AIWorker {
}


function create(agent: Agent) {

  return agent.initializeWorker(
    { type: "request" },
    [
      // { type: "execute", direction: "output", title: "Next", name: "next" },
    ],
    request
  )

}

async function execute(worker: InputWorker, p: AgentParameters) {

  for (const key in worker.handles) {
    const h = worker.handles[key]
    h.value = p.input[h.name]
  }

}


export const request: WorkerRegistryItem = {
  title: "Input",
  category: "io",
  type: "request",
  description: "This worker serves as a schema of the request",
  execute,
  create,
  get registry() { return request },
}

