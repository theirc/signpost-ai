declare global {
  interface HITLWorker extends AIWorker {
    fields: {
      enable: NodeIO
      causes: NodeIO
      enabled: NodeIO
    }
  }
}

async function execute(worker: HITLWorker, { state, uid }: AgentParameters) {

  const { enable, enabled, causes } = worker.fields

  enabled.value = state.agent.hitl.active || false

  if (enable.value) {
    if (!uid) throw new Error("HITL worker requires an uid to work.")
    enabled.value = true
    state.agent.hitl.active = true
    state.agent.hitl.causes = causes.value || []
  }
}

function create(agent: Agent) {
  return agent.initializeWorker(
    { type: "hitl" },
    [
      { type: "boolean", direction: "input", title: "Enable", name: "enable" },
      { type: "string[]", direction: "input", title: "Causes", name: "causes" },
      { type: "boolean", direction: "output", title: "Enabled", name: "enabled" },
    ],
    hitl
  )
}

export const hitl: WorkerRegistryItem = {
  title: "HITL",
  category: "tool",
  type: "hitl",
  description: "Human In The Loop - allows human intervention in the flow.",
  execute,
  create,
  get registry() { return hitl },
}
