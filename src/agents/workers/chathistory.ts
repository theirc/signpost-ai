import { AgentInputItem } from "@openai/agents"
import { supabase } from '../db'
import { createModel } from "../utils"
import { Database } from "../supabase"
import { CoreMessage, generateText } from 'ai'

type HistoryItem = Partial<Database["public"]["Tables"]["history"]["Insert"]>

declare global {
  interface ChatHistoryWorker extends AIWorker {
    parameters: {
      history?: HistoryMode
      keepLatest?: number
      sumarizeWhen?: number
      sumarizePrompt?: string
      sumarizationModel?: string
    }
    fields: {
      output: NodeIO
    }
    saveHistory(worker: ChatHistoryWorker, p: AgentParameters, history: AgentInputItem[]): Promise<void>

  }
}

const sumarizePrompt = "Sumarize the chat history and keep the most important points of the conversation, return only the summary."

async function execute(worker: ChatHistoryWorker, p: AgentParameters) {
  // Empty execute function for now
  // worker.fields.output.value = []

  if (!p.uid) {
    worker.error = "No uuid provided"
    return
  }

  let history: AgentInputItem[] = []

  const dbHistory = await supabase.from("history").select("*")
    .eq("uid", p.uid)
    .eq("agent", `${p.agent.id}`)
    .eq("worker", worker.id).order("id", { ascending: true })

  if (dbHistory.error) {
    console.log("DB Error", dbHistory.error)
    worker.error = dbHistory.error.toString()
    return
  }
  if (dbHistory.data) history = dbHistory.data.map((h) => {
    h.payload["__FROM_DB__"] = true
    return h.payload as any
  })

  worker.fields.output.value = history || []

}

async function saveHistory(worker: ChatHistoryWorker, p: AgentParameters, history: AgentInputItem[]) {

  console.log("Saving History", history)

  if (!p.uid) return
  const historyType = worker.parameters.history || "full"
  const keepLatest = worker.parameters.keepLatest || 100
  const sumarizeWhen = worker.parameters.sumarizeWhen || 200
  const sumarizationPrompt = worker.parameters.sumarizePrompt || sumarizePrompt

  let newItems = history.filter((h: any) => !h.__FROM_DB__)

  if (historyType === "sumarized" && keepLatest && history.length > sumarizeWhen) {

    const latestItems = history.slice(-keepLatest)
    const nonLatestItems = history.slice(0, -keepLatest)

    console.log("Summarizing History", latestItems, nonLatestItems)

    const model = createModel(p.apiKeys, worker.parameters.sumarizationModel ||= "openai/gpt-4-turbo")
    let messages = history.filter((h: AgentInputItem) => h.type == "message").map((h: AgentInputItem) => {
      if (h.type == "message") return { role: h.role, content: (h.content[0] as any)?.text } satisfies CoreMessage
    })

    messages = [{
      role: "system",
      content: sumarizationPrompt
    }, ...messages]

    const { text } = await generateText({
      model,
      temperature: 0,
      messages,
    })

    newItems = [{ type: "message", role: "system", content: [{ type: "text", text }] }] as any
    await supabase.from("history").delete().eq("uid", p.uid)
    console.log("Summarized History", text)
  } else {
    newItems = history
  }

  for (const item of newItems) {
    await supabase.from("history").insert({
      uid: p.uid,
      agent: `${p.agent.id}`,
      worker: worker.id,
      arguments: (item as any).arguments,
      content: (item as any).content,
      name: (item as any).name,
      role: (item as any).role,
      status: (item as any).status,
      type: item.type,
      payload: item
    } satisfies HistoryItem)
  }

}



export const chatHistory: WorkerRegistryItem = {
  title: "Chat History",
  execute,
  category: "tool",
  type: "chatHistory",
  description: "Worker that provides chat history functionality.",
  create(agent: Agent) {
    const w = agent.initializeWorker(
      {
        type: "chatHistory",
        parameters: {
          history: "full",
          keepLatest: 100,
          sumarizeWhen: 200,
          sumarizePrompt: "Sumarize the chat history and keep the most important points of the conversation, return only the summary.",
          sumarizationModel: "openai/gpt-4-turbo",
        },
      },
      [
        { type: "chat", direction: "output", title: "History", name: "output" },
      ],
      chatHistory
    ) as ChatHistoryWorker
    w.saveHistory = saveHistory
    return w
  },
  get registry() { return chatHistory },
}
