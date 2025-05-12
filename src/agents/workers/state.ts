import { z } from "zod"
import { supabase } from "../db"

declare global {
  interface StateWorker extends AIWorker {
  }
}

async function execute(worker: StateWorker, p: AgentParameters) {

  if (!p.uid) return
  if (z.string().uuid().safeParse(p.uid).success === false) return

  const dbState = await supabase.from("states").select("*").eq("id", p.uid).single()

  const finalState = {}
  const state = (dbState.data?.state || {}) as {}
  const inputs = worker.getInputHandlersByName()
  const outputs = worker.getOutputHandlersByName()

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
    if (o) o.value = finalState[key]
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
      [],
      state
    ) as StateWorker
    w.parameters.mode = "nonempty"
    return w
  },
  get registry() { return state },
}


