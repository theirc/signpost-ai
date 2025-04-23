
declare global {
  type CombineWorkerMode = "concat" | "nonempty"
  interface CombineWorker extends AIWorker {
    fields: {
      input1: NodeIO
      input2: NodeIO
      output: NodeIO
    }
    parameters: {
      mode?: CombineWorkerMode
    }
  }
}

async function execute(worker: CombineWorker) {

  if (worker.parameters.mode === "nonempty") {

    if (Array.isArray(worker.fields.input1.value)) {
      if (worker.fields.input1.value.length > 0) {
        worker.fields.output.value = worker.fields.input1.value
      } else {
        worker.fields.output.value = worker.fields.input2.value
      }
      return
    }

    if (worker.fields.input1.value) {
      worker.fields.output.value = worker.fields.input1.value
    } else {
      worker.fields.output.value = worker.fields.input2.value
    }
  }

  if (worker.parameters.mode === "concat") {

    if (typeof worker.fields.input1.value == "string") {
      worker.fields.output.value = `${worker.fields.input1.value || ""}${worker.fields.input2.value || ""}`
    } else if (Array.isArray(worker.fields.input1.value)) {
      worker.fields.output.value = [...(worker.fields.input1.value || []), ...(worker.fields.input2.value || [])]
    }

  }
}


export const combine: WorkerRegistryItem = {
  title: "Combine",
  execute,
  category: "tool",
  type: "combine",
  description: "This worker allows you to combine two inputs into one output",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      { type: "combine" },
      [
        { type: "unknown", direction: "input", title: "Input", name: "input1" },
        { type: "unknown", direction: "input", title: "Input", name: "input2" },
        { type: "unknown", direction: "output", title: "Result", name: "output" },
      ],
      combine
    ) as CombineWorker
    w.parameters.mode = "nonempty"
    return w
  },
  get registry() { return combine },
}


