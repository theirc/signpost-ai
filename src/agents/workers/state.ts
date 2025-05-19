import { z } from "zod"
import { supabase } from "../db"

declare global {
  interface StateWorker extends AIWorker {
    fields: {
      json: NodeIO
    }
  }
}

async function execute(worker: StateWorker, p: AgentParameters) {

  const inputs = worker.getInputHandlersByName()
  const outputs = worker.getOutputHandlersByName()
  const json = {}

  if (!p.uid || z.string().uuid().safeParse(p.uid).success === false) {
    for (const key in inputs) {
      const i = inputs[key]
      const o = outputs[key]
      if (i && o) {
        o.value = i.value
        json[i.name] = i.value
      }
    }
    return
  }

  const dbState = await supabase.from("states").select("*").eq("id", p.uid).single()

  const finalState = {}
  const state = (dbState.data?.state || {}) as {}

  for (const key in inputs) {
    const i = inputs[key]
    if (i.value != null) {
      finalState[i.name] = i.value
    } else {
      finalState[i.name] = state[i.name]
    }
  }

  for (const key in finalState) {
    const o = outputs[key]
    if (o) {
      o.value = finalState[key]
      json[o.name] = finalState[key]
    }
  }

  await supabase.from("states").upsert({ id: p.uid, state: finalState })

}


export const state: WorkerRegistryItem = {
  title: "State",
  execute,
  category: "tool",
  type: "state",
  description: "This worker allows you to save a state for later use.",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      { type: "state" },
      [
        { type: "json", direction: "output", title: "JSON", name: "json", system: true },
      ],
      state
    ) as StateWorker
    w.parameters.mode = "nonempty"
    return w
  },
  get registry() { return state },
}


