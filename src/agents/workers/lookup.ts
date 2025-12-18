declare global {
  interface LookupWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
    parameters: {
      lookupTable?: Record<string, string>
      defaultValue?: string
    }
  }
}

function create(agent: Agent) {
  return agent.initializeWorker(
    {
      type: "lookup",
      conditionable: true,
      parameters: {
        lookupTable: {},
        defaultValue: "",
      },
    },
    [
      { type: "string", direction: "input", title: "Input", name: "input" },
      { type: "string", direction: "output", title: "Output", name: "output" },
    ],
    lookup
  )
}

async function execute(worker: LookupWorker, p: AgentParameters) {
  const input = worker.fields.input.value
  const lookupTable = worker.parameters.lookupTable || {}
  const defaultValue = worker.parameters.defaultValue || ""

  if (!input) {
    worker.fields.output.value = defaultValue
    return
  }

  // Convert input to string for comparison
  const inputKey = String(input).trim()

  // Check if the input key exists in the lookup table
  if (lookupTable.hasOwnProperty(inputKey)) {
    worker.fields.output.value = lookupTable[inputKey]
  } else {
    // Return default value if key not found
    worker.fields.output.value = defaultValue
  }
}

export const lookup: WorkerRegistryItem = {
  title: "Lookup",
  category: "tool",
  type: "lookup",
  description: "This worker performs key-value lookups. Returns the value if the input text matches a key.",
  execute,
  create,
  get registry() { return lookup },
}

