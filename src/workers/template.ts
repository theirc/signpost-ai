import { generateTemplate, workers } from "./workers"

async function execute(w: AgentWorker, a: Agent, payload: Payload) {
  if (!w.output || !w.template) return
  payload[w.output] = generateTemplate(a, w.template, payload)
}

workers.content = execute

