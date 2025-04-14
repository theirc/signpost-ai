
function create(agent: Agent) {

  return agent.initializeWorker(
    { type: "response" },
    [
      // { type: "execute", direction: "input", title: "Execute", name: "execute" },
    ],
    response
  )

}

async function execute(worker: AIWorker, p: AgentParameters) {


  const handlers = Object.values(worker.handles)
  const values = {}
  for (const h of handlers) {
    if (!h.value) continue
    values[h.name] = h.value
  }

  p.output = values
  // console.log("Response: ", values)

}


export const response: WorkerRegistryItem = {
  title: "Response",
  execute,
  create,
  get registry() { return response },
}

