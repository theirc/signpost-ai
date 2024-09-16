import { ai } from "../ai"
import { workers } from "./workers"

async function execute(w: AgentWorker, a: Agent, payload: Payload) {

  if (!w.model || !w.input || !w.output) return

  let history: ChatHistoryItem[] = []

  if (payload.prompt) history.push({ role: 'assistant', content: payload.prompt })

  history = [...history, ...a.history]
  history.push({ role: 'user', content: payload[w.input] })

  const answer = await ai.request({
    model: w.model,
    temperature: w.temperature || 0,
    history,
  })

  payload[w.output] = answer.answer

}

workers.ai = execute
