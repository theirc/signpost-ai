
declare global {
  type CombineWorkerMode = "concat" | "nonempty"
  interface CombineWorker extends AIWorker {
    fields: {
      input1: NodeIO
      input2: NodeIO
      output: NodeIO
      [key: string]: NodeIO
    }
    parameters: {
      mode?: CombineWorkerMode
      inputCount?: number
    }
  }
}

async function execute(worker: CombineWorker) {
  // Get all input fields
  const inputFields = Object.entries(worker.fields)
    .filter(([key, field]) => key.startsWith('input') && field.direction === 'input')
    // Sort by input number for consistent ordering
    .sort((a, b) => {
      const aNum = parseInt(a[0].replace('input', '')) || 0;
      const bNum = parseInt(b[0].replace('input', '')) || 0;
      return aNum - bNum;
    })
    .map(([_, field]) => field);

  if (worker.parameters.mode === "nonempty") {
    // Find the first non-empty input
    for (const input of inputFields) {
      if (Array.isArray(input.value)) {
        if (input.value.length > 0) {
          worker.fields.output.value = input.value;
          return;
        }
      } else if (input.value) {
        worker.fields.output.value = input.value;
        return;
      }
    }
    
    // If all inputs are empty, use the last input (which will be empty)
    worker.fields.output.value = inputFields[inputFields.length - 1]?.value || null;
  }

  if (worker.parameters.mode === "concat") {
    // Handle string concatenation
    if (typeof inputFields[0]?.value === "string") {
      worker.fields.output.value = inputFields
        .map(input => input.value || "")
        .join("");
    } 
    // Handle array concatenation
    else if (Array.isArray(inputFields[0]?.value)) {
      worker.fields.output.value = inputFields
        .flatMap(input => Array.isArray(input.value) ? input.value : []);
    }
  }
}


export const combine: WorkerRegistryItem = {
  title: "Combine",
  execute,
  category: "tool",
  type: "combine",
  description: "This worker allows you to combine multiple inputs into one output",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      { type: "combine" },
      [
        { type: "unknown", direction: "input", title: "Input 1", name: "input1" },
        { type: "unknown", direction: "input", title: "Input 2", name: "input2" },
        { type: "unknown", direction: "output", title: "Result", name: "output" },
      ],
      combine
    ) as CombineWorker
    w.parameters.mode = "nonempty"
    w.parameters.inputCount = 2 // Default to 2 inputs for backward compatibility
    return w
  },
  get registry() { return combine },
}
