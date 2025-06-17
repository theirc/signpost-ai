import { z } from "zod"
import { supabase } from "../db"

declare global {
  interface StateWorker extends AIWorker {
    fields: {
      input: NodeIO
      output: NodeIO
    }
  }
}

async function execute(worker: StateWorker, p: AgentParameters) {

  if (worker.fields.input.value != null) {
    p.state[worker.id] = worker.fields.input.value
  }

  worker.fields.output.value = p.state[worker.id]

  // const inputs = worker.getInputHandlersByName()
  // const outputs = worker.getOutputHandlersByName()
  // const json = {}

  // if (!p.uid || z.string().uuid().safeParse(p.uid).success === false) {
  //   for (const key in inputs) {
  //     const i = inputs[key]
  //     const o = outputs[key]
  //     if (i && o) {
  //       o.value = i.value
  //       json[i.name] = i.value
  //     }
  //   }
  //   return
  // }

  // const dbState = await supabase.from("states").select("*").eq("id", p.uid).single()

  // const finalState = {}
  // const state = (dbState.data?.state || {}) as {}

  // for (const key in inputs) {
  //   const i = inputs[key]
  //   if (i.value != null) {
  //     finalState[i.name] = i.value
  //   } else {
  //     finalState[i.name] = state[i.name]
  //   }
  // }

  // for (const key in finalState) {
  //   const o = outputs[key]
  //   if (o) {
  //     o.value = finalState[key]
  //     json[o.name] = finalState[key]
  //   }
  // }

  // await supabase.from("states").upsert({ id: p.uid, state: finalState })

}


export const state: WorkerRegistryItem = {
  title: "Persist",
  execute,
  category: "tool",
  type: "state",
  description: "This worker allows you to persist data for later use.",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      { type: "state" },
      [
        { type: "unknown", direction: "input", title: "Input", name: "input", system: true },
        { type: "unknown", direction: "output", title: "Output", name: "output", system: true },
      ],
      state
    ) as StateWorker
    return w
  },
  get registry() { return state },
}


