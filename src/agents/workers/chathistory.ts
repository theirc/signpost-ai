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
    saveHistory(worker: ChatHistoryWorker, p: AgentParameters, history: AgentInputItem[], searchContext?: string): Promise<void>

  }
}

const sumarizePrompt = "Sumarize the chat history and keep the most important points of the conversation, return only the summary."

async function execute(worker: ChatHistoryWorker, p: AgentParameters) {

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

async function saveHistory(worker: ChatHistoryWorker, p: AgentParameters, history: AgentInputItem[], searchContext?: string) {

  if (!p.uid) return

  console.log("Saving History", history)
  console.log("Search Context", searchContext)

  const historyType = worker.parameters.history || "full"
  const keepLatest = Number(worker.parameters.keepLatest) || 100
  const sumarizeWhen = Number(worker.parameters.sumarizeWhen) || 200
  const sumarizationPrompt = worker.parameters.sumarizePrompt || sumarizePrompt

  let newItems = history.filter((h: any) => !h.__FROM_DB__)
  let oldMessages = history.filter((h: any) => !!h.__FROM_DB__)

  if (historyType === "sumarized") {

    console.log("Summarizing History...")

    if (oldMessages.length > sumarizeWhen + keepLatest) {

      const dbHistory = await supabase.from("history").select("*")
        .eq("uid", p.uid)
        .eq("type", "message")
        .eq("agent", `${p.agent.id}`)
        .eq("worker", worker.id).order("id", { ascending: true })

      const oldItems = (dbHistory.data || [])

      const toRemoveLength = oldItems.length - keepLatest

      if (toRemoveLength > 0) {

        const messagesToDelete = oldItems.slice(0, toRemoveLength)

        let messages = messagesToDelete.map((h) => {
          if (h.type == "message") return { role: h.role as any, content: (h.content[0] as any)?.text } satisfies CoreMessage
        })

        console.log(`Deleting ${messagesToDelete.length} Messages`)
        const model = createModel(p.apiKeys, worker.parameters.sumarizationModel ||= "openai/gpt-4-turbo")

        messages = [{
          role: "system",
          content: sumarizationPrompt
        }, ...messages]

        const { text } = await generateText({
          model,
          temperature: 0,
          messages,
        })

        console.log("Summarized History: ", text)

        const idsTodelete = messagesToDelete.map((h: any) => h.id)
        const minId = Math.min(...idsTodelete)

        console.log("Min id:", minId)
        await supabase.from("history").delete().in("id", idsTodelete)

        await supabase.from("history").insert({
          id: minId,
          uid: p.uid,
          agent: `${p.agent.id}`,
          worker: worker.id,
          type: "message",
          role: "system",
          content: [{ text }],
          payload: { role: "system", type: "message", content: [{ text, type: "text" }] }
        } satisfies HistoryItem)
      }

    }

    /*
    {"role": "system", "type": "message", "content": [{"text": "Name: Guillermo\nEmail: rev@email.com\nCourse: Curso 1", "type": "text"}]}
    */

  }

  const newItemsToSave = newItems.map((item: AgentInputItem) => {
    return {
      uid: p.uid,
      agent: `${p.agent.id}`,
      worker: worker.id,
      arguments: (item as any).arguments,
      content: (item as any).content,
      name: (item as any).name,
      role: (item as any).role,
      status: (item as any).status,
      type: item.type,
      payload: item,
      searchContext
    }
  }) satisfies HistoryItem[]

  await supabase.from("history").insert(newItemsToSave)

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
