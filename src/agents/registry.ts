import { agentWorker } from "./workers/agent"
import { ai } from "./workers/ai"
import { combine } from "./workers/combine"
import { display } from "./workers/display"
import { request } from "./workers/input"
import { mock } from "./workers/mock"
import { response } from "./workers/response"
import { schema } from "./workers/schema"
import { search } from "./workers/search"
import { text } from "./workers/text"
import { api } from "./workers/api"
import { documentSelector } from "./workers/documentselector"
import { state } from "./workers/state"
import { stt } from "./workers/stt"
import { tts } from "./workers/tts"
import { translate } from "./workers/translate"
import { promptAgent } from "./workers/promptAgent"
import { handoffAgent } from "./workers/handoffAgent"


type WorkerCategories = "io" | "generator" | "debug" | "tool"

declare global {

  type WorkerTypes = keyof typeof workerRegistry

  interface WorkerRegistryItem {
    title: string
    icon?: any
    category: WorkerCategories
    type: WorkerTypes
    description?: string
    execute(worker: AIWorker, p: AgentParameters): Promise<void>
    create(agent: Agent): AIWorker
    registry?: this
  }

}

export const workerRegistry = {

  request,
  response,

  ai,
  schema,
  agentWorker,
  text,

  search,
  combine,
  documentSelector,

  mock,
  display,
  api,
  state,
  stt,
  tts,
  translate,
  promptAgent,
  handoffAgent,

} satisfies { [index: string]: WorkerRegistryItem }
