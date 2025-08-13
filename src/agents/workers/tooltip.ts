declare global {
  interface TooltipWorker extends AIWorker {
    parameters: {
      notes?: string
    }
  }
}

function create(agent: Agent) {
  return agent.initializeWorker(
    { type: "tooltip" },
    [],
    tooltip
  )
}

async function execute(worker: TooltipWorker, p: AgentParameters) {
  // Tooltip worker doesn't execute anything - it's just for visual notes
  return
}

export const tooltip: WorkerRegistryItem = {
  title: "Tooltip",
  category: "debug",
  type: "tooltip",
  description: "Add notes and tooltips to your flow",
  execute,
  create,
  get registry() { return tooltip },
}