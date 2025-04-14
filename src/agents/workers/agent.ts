
declare global {
  interface AgentWorker extends AIWorker {
    parameters: {
      agent?: number
    }

  }
}

async function execute(worker: AgentWorker, p: AgentParameters) {

  if (!worker.referencedAgent) return

  const agent: Agent = worker.referencedAgent
  const inp = agent.getInputWorker()
  const out = agent.getResponseWorker()
  if (!inp || !out) return

  const locp = {
    ...p,
    debug: false,
    agent,
    input: {}
  }
  console.log("Agent Worker Execute Parameters: ", locp)

  for (const h of worker.handlersArray) {
    if (h.direction === "input") {
      locp.input[h.name] = h.value
    }
  }

  await agent.execute(locp)

  console.log("Agent Worker result: ", locp.output)

  for (const h of worker.handlersArray) {
    if (h.direction === "output") {
      h.value = locp.output[h.name]
    }
  }

}

export const agentWorker: WorkerRegistryItem = {
  title: "Agent",
  execute,
  create(agent: Agent) {
    return agent.initializeWorker(
      { type: "agentWorker" },
      [
        // { type: "unknown", direction: "input", title: "Input", name: "input" },
        // { type: "unknown", direction: "output", title: "Ouput", name: "output" },
      ],
      agentWorker
    )
  },
  get registry() { return agentWorker },
}

