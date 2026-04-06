import { supabase } from "./db"
import { workerRegistry } from "./registry"
import { buildWorker } from "./worker"
import { ulid } from 'ulid'
import { ApiWorker } from "./workers/api"
import { integrations } from "./integrations"
import { evaluate, updateContact } from "./evals/evals"
import { generateObject } from "ai"
import { createOpenAI } from "@ai-sdk/openai"
import { z } from "zod"

type LogTypes = "execution" | "error" | "info" | "handoff" | "tool_start" | "tool_end"

interface AgentConfig {
  edges?: object
  id?: number
  title?: string
  description?: string
  type?: AgentTypes
  workers?: object
  team_id?: string
  debuguuid?: string
  versions?: AgentVersion[]
  config?: {
    evalItems?: number[]
    escalation_flags?: AgentEscalationFlag[]
  }
  fork_id?: number | string | null
  fork_base?: AgentConfig | null
}

interface MergeResult {
  originalId: number
  conflicts: {
    workers: string[]
    edges: string[]
    fields: string[]
  }
  hasConflicts: boolean
}

interface AgentLog {
  team_id?: string
  type?: LogTypes
  worker?: string
  workerId?: string
  session?: string
  inputTokens?: number
  outputTokens?: number
  message?: string
  handles?: any
  parameters?: any
}


declare global {
  type AgentTypes = "conversational" | "data"

  interface AgentVersion {
    title?: string
    date?: number
    agent?: any
  }

  interface HITLPayload {
    integration?: IntegrationPayload
    causes?: string[]
  }

}



export function createAgent(config: AgentConfig) {

  const workers: { [index: string]: AIWorker } = {}
  const edges: EdgeConnections = (config.edges as EdgeConnections) || {}

  const agent = {

    get id() { return config.id },
    set id(v: number) { config.id = v },
    get title() { return config.title },
    set title(v: string) { config.title = v },


    get isConversational() {
      const input = agent.getInputWorker()
      const response = agent.getResponseWorker()
      if (input && response) {
        const hasMessageHandles = Object.values(input.handles).some((h) => h.direction === "output" && h.type === "string" && h.name === "message")
        const hasResponseHandles = Object.values(response.handles).some((h) => h.direction === "input" && h.type === "string" && h.name === "response")
        return hasMessageHandles && hasResponseHandles
      }
      return false
    },


    edges,
    workers,
    displayData: true,
    evalItems: [] as number[],
    escalationFlags: [] as AgentEscalationFlag[],

    parameters: {} as AgentParameters,
    type: "data" as AgentTypes,
    debuguuid: config.debuguuid || "",
    fork_id: (config.fork_id ?? null) as number | string | null,
    description: "",
    currentWorker: null as AIWorker,
    versions: [] as AgentVersion[],
    execution: null as string,
    toolCallNodes: [] as { name: string; arguments: string; result: string; sourceWorkerId: string }[],

    update() {
      //Used to update the UI in front end
    },

    updateWorkers() {
      for (const key in workers) {
        const w = workers[key]
        w.updateWorker()
      }
    },

    getResponseWorker() {
      for (const key in workers) {
        if (workers[key].config.type === "response") return workers[key]
      }
      return null
    },

    getHistoryWorker(): ChatHistoryWorker {
      for (const key in workers) {
        if (workers[key].config.type === "chatHistory") return workers[key] as ChatHistoryWorker
      }
      return null
    },

    getEndAPIWorkers(p: AgentParameters) {
      const apiWorkers: ApiWorker[] = []
      for (const key in workers) {
        const w = workers[key]
        if (w.config.type !== "api") continue
        const outputHandles = Object.values(w.handles).filter((h) => h.direction === "output")
        if (outputHandles.length === 0) continue
        const cw = w.getConnectedWokers(p)
        if (cw.length === 0) continue
        apiWorkers.push(w as any)
      }
      return apiWorkers
    },

    getInputWorker() {
      for (const key in workers) {
        if (workers[key].config.type === "request") return workers[key]
      }
      return null
    },

    hasInput() {
      for (const key in workers) {
        if (workers[key].config.type === "request") return true
      }
      return false
    },

    hasResponse() {
      return agent.getResponseWorker() !== null
    },

    reset() {
      agent.parameters = {}
      agent.execution = ulid()
      agent.toolCallNodes = []
      for (const key in workers) {
        const w = workers[key]
        w.executed = false
        w.error = null
        for (const key in w.handles) {
          const h = w.handles[key]
          h.value = h.default || undefined
        }
      }
    },

    async sendUserHITLMessage(hitlPayload: HITLPayload) {

      try {

        let { uid, team, state, integration: integrationPayload } = agent.parameters

        state.agent ||= {}
        hitlPayload ||= {}
        hitlPayload.causes ||= state.agent.hitl.causes || []
        hitlPayload.integration = integrationPayload || {}

        console.log(`Processing HITL for '${agent.title}`)

        const message = (agent.parameters as any).input.message

        if (message) {
          console.log(`Saving message for '${agent.title} in HITL: ${message}'`)

          const historyWorker = agent.getHistoryWorker()

          if (historyWorker) await historyWorker.addMessageToHistory(uid, `${agent.id}`, team, "user", message)

          await supabase.from("events").upsert({
            id: uid,
            agent: agent.id,
            team,
            message,
            payload: hitlPayload as any
          })
          agent.currentWorker = null
          agent.update()
          return

        } else {
          console.log(`Message not found`)
        }

      } catch (error) {
        await agent.log({ type: "error", message: error?.toString() || "Unknown error" })
      }

    },

    async sendHumanHITLMessage(message: string, uid: string, team: string, endSession: boolean, integrationPayload: IntegrationPayload) {

      if (!message) return

      try {
        console.log(`Saving Human message for '${agent.title} in HITL: ${message}'`)
        const historyWorker = agent.getHistoryWorker()
        if (historyWorker) await historyWorker.addMessageToHistory(uid, `${agent.id}`, team, "human", message)

        if (integrationPayload?.type === "telerivet") await integrations.telerivet.sendMessage(message, integrationPayload)

        if (endSession) {
          const { data, error } = await supabase.from("states").select("*").eq("id", uid).single()
          if (data && data.state) {
            const state: AgentState = data.state as any
            state.agent ||= {}
            state.agent.hitl ||= {}
            state.agent.hitl.active = false
            delete state.agent.hitl.causes
            await supabase.from("states").update({ state: state as any }).eq("id", uid)
          }
          await supabase.from("events").delete().eq("id", uid)
        }


      } catch (error) {
        await agent.log({ type: "error", message: error?.toString() || "Unknown error" })
      }
    },

    async execute(p: AgentParameters) {

      // ───── Intialization ───────────────────────────────────────────────────────

      agent.reset()
      p.input ||= {}
      p.output ||= {}
      p.apiKeys ||= {}
      p.state ||= { agent: {}, workers: {} }
      p.state.agent ||= {}
      p.state.agent.hitl ||= {}
      p.state.workers ||= {}
      p.team = config.team_id || ""
      p.logWriter ||= () => { }
      p.agent = agent
      p.integration ||= {}

      if (p.debug && agent.debuguuid && !p.uid) p.uid = agent.debuguuid

      const message: string = p.input.message
      let contact: Contact = null

      agent.parameters = p

      const integrationType = p.integration?.type as string | undefined
      const isSimulationChannel = integrationType === "simulation" || integrationType === "app"

      // ───── Contact Detection ───────────────────────────────────────────────────────

      if (p.integration && p.apiKeys?.codec) {
        contact = await integrations.getOrCreateContact(p.integration, p.apiKeys.codec, p.team)
        if (contact?.id) p.integration.contact = contact.id
      }

      // ───── Commands ───────────────────────────────────────────────────────

      if (message && message.trim().toLowerCase() === "/reset") {
        await agent.resetAgent(p.uid, contact?.id)
        p.output.response = "The chat history and state has been reset."
        p.commandExecuted = "reset"
        agent.currentWorker = null
        agent.update()
        console.log("The chat history and state has been reset.")
        return
      }

      // ───── Clean Workers ───────────────────────────────────────────────────────

      for (const key in agent.workers) {
        const w = agent.workers[key]
        w.agent = agent
        w.executed = false
      }

      // ───── State ───────────────────────────────────────────────────────

      const hasUid = !!p.uid

      if (hasUid) {
        const dbState = await supabase.from("states").select("*").eq("id", p.uid).single()
        if (dbState.data) {
          p.state = dbState.data.state as any
          p.state ||= { agent: {}, workers: {} }
          p.state.agent ||= {}
          p.state.workers ||= {}
        }
      }

      // ───── User message (codec: direct insert; simulation/app: integrations.saveMessage) ─────

      let userMessageId: string = null

      try {
        if (contact && message && p.apiKeys?.codec) {
          const { data: userMessage, error: userMsgErr } = await supabase.from("messages").insert({
            contact: contact.id,
            role: "user",
            message,
            channel: p.integration.type,
            team: p.team,
            agent: agent.id,
          } satisfies Message).select().single()
          if (userMsgErr) throw userMsgErr
          userMessageId = userMessage.id
        } else if (isSimulationChannel && p.integration && message) {
          const { contact: detectedContact, messageId } = await integrations.saveMessage({
            integration: p.integration,
            password: p.apiKeys?.codec,
            contact: p.integration.contact,
            team: p.team,
            role: "user",
            message,
            agent: agent.id
          })
          contact = detectedContact ?? contact
          userMessageId = messageId
          if (detectedContact?.id) p.integration.contact = detectedContact.id
        }
      } catch (error) {
        console.error('[Agent] Error saving user message:', error)
      }

      // ───── HITL ───────────────────────────────────────────────────────

      if (hasUid && p.state?.agent?.hitl?.active) {
        await agent.sendUserHITLMessage({
          causes: p.state.agent?.hitl.causes || [],
          integration: p.integration || {}
        })
        agent.currentWorker = null
        agent.update()
        return
      }

      // ───── Execution ───────────────────────────────────────────────────────

      const worker = agent.getResponseWorker()
      const apiWorkers = agent.getEndAPIWorkers(p)

      if (!worker && !apiWorkers.length) return

      try {
        await worker.execute(p)
        for (const w of apiWorkers) {
          await w.execute(p)
        }

        if (hasUid) await supabase.from("states").upsert({ id: p.uid, state: p.state || {} })

      } catch (error) {
        await agent.log({ type: "error", message: error?.toString() || "Unknown error" })
        console.error('[Agent] worker execution error:', error)
        p.error = error.toString()
      }

      // ───── Errors ───────────────────────────────────────────────────────

      if (p?.error) {
        agent.currentWorker = null
        agent.update()
        return
      }

      const response = p.output?.response
      let agentMessageId: string = null

      // ───── Save assistant message ────────────────────────────────────────

      const contactIdForMessage = contact?.id ?? p.integration?.contact

      try {
        if (contactIdForMessage && response && p.integration?.type) {
          const { data: agentMessage, error: agentMsgErr } = await supabase.from("messages").insert({
            contact: contactIdForMessage,
            role: "assistant",
            message: response,
            channel: p.integration.type,
            team: p.team,
            agent: agent.id,
          } satisfies Message).select().single()
          if (agentMsgErr) throw agentMsgErr
          agentMessageId = agentMessage.id
        }
      } catch (err) {
        console.error('[Agent] Error saving agent message:', err)
      }

      if (!contact && contactIdForMessage) {
        const { data: cRow } = await supabase.from("contacts").select().eq("id", contactIdForMessage).single()
        if (cRow) contact = cRow as unknown as Contact
      }

      // ───── Flags + evals (await in debug; otherwise p.evalPromise) ─────

      const canRunFlags = !!(contact && userMessageId && message && response && agent.escalationFlags?.filter(f => f.enabled).length && p.apiKeys?.openai)
      const canRunEvals = !!(contact && message && response && agent.evalItems?.length && userMessageId && agentMessageId)

      const runFlagsAndEvals = async () => {
        if (canRunFlags) {
          const enabledFlags = agent.escalationFlags.filter(f => f.enabled)
          try {
            const openai = createOpenAI({ apiKey: p.apiKeys.openai })
            const now = new Date().toISOString()
            const customFlags: FlagDetectedItem[] = []
            const builtinColUpdates: Record<string, number> = {}

            const BUILTIN_FLAG_COL: Record<string, "highrisk" | "lowconf" | "askhuman"> = {
              high_risk: "highrisk",
              low_confidence: "lowconf",
              asked_human: "askhuman",
            }

            const FlagSchema = z.object({
              triggered: z.boolean().describe("Whether this flag condition is met"),
              confidence: z.number().min(0).max(1).describe("Confidence from 0 to 1"),
              reasoning: z.string().describe("Brief explanation"),
            })

            await Promise.all(enabledFlags.map(async (flag) => {
              try {
                const { object } = await generateObject({
                  model: openai("gpt-4o-mini"),
                  schema: FlagSchema,
                  system: `You are a flag detection system for a humanitarian AI assistant. Evaluate whether the following condition is met.\n\nCondition: ${flag.detection_prompt}`,
                  prompt: `User message: ${message}\n\nAgent response: ${response}`,
                })
                if (object.triggered && object.confidence >= 0.35) {
                  const col = BUILTIN_FLAG_COL[flag.id]
                  if (col) {
                    builtinColUpdates[col] = 1
                  } else {
                    customFlags.push({ flagId: flag.id, status: "flagged", reasoning: object.reasoning, confidence: object.confidence, detectedAt: now })
                  }
                  await agent.log({ type: "info", message: `Flag triggered: ${flag.label} (${flag.id}) — ${object.reasoning}` })
                }
              } catch (err) {
                console.error(`[Agent] Error evaluating flag "${flag.id}":`, err)
              }
            }))

            if (Object.keys(builtinColUpdates).length > 0 || customFlags.length > 0) {
              const upd: Record<string, unknown> = { ...builtinColUpdates }
              if (customFlags.length > 0) upd.custom_message_flags = customFlags
              const { error: flagErr } = await supabase.from("messages").update(upd as any).eq("id", userMessageId)
              if (flagErr) console.error('[Agent] Failed to write flag columns / custom_message_flags:', flagErr)
            }
          } catch (err) {
            console.error('[Agent] Escalation flags error:', err)
          }
        }

        if (canRunEvals) {
          if (!p.apiKeys?.openai) return
          if (p.debug) {
            await agent.updateEvaluations(contact, message, response, userMessageId, agentMessageId, p.apiKeys)
          } else {
            await new Promise<void>((resolve) => {
              setTimeout(async () => {
                await agent.updateEvaluations(contact, message, response, userMessageId, agentMessageId, p.apiKeys)
                resolve()
              }, 1)
            })
          }
        }
      }

      if (canRunFlags || canRunEvals) {
        if (p.debug) {
          await runFlagsAndEvals()
        } else {
          p.evalPromise = runFlagsAndEvals()
        }
      }

      // ───── End ───────────────────────────────────────────────────────

      if (hasUid && p.state?.agent?.hitl?.active) await agent.sendUserHITLMessage({
        causes: p.state?.agent?.hitl?.causes || [],
        integration: p.integration || {}
      })

      agent.currentWorker = null
      agent.update()

    },

    async updateEvaluations(contact: Contact, message: string, response: string, userMessageId: string, agentMessageId: string, apiKeys: APIKeys) {
      try {

        const { data: messages, error: messageError } = await supabase.from("messages").select().eq("contact", contact.id).order("created_at", { ascending: true }).limit(10)
        if (messageError) throw messageError
        const { data: items, error: itemsError } = await supabase.from("eval_items").select().in("id", agent.evalItems)
        if (itemsError) throw itemsError

        const result = await evaluate(message, response, messages as any, contact, items as any, apiKeys)

        contact = updateContact(contact, result, items as any)

        await supabase.from("messages").update({
          user_detected_items: result.detectedItems || null,
          escalation_from_level: result.escalation?.fromLevel || null,
          escalation_to_level: result.escalation?.toLevel || null,
          escalation_reasoning: result.escalation?.reasoning || null,
        }).eq('id', userMessageId)

        await supabase.from("messages").update({
          agent_appropriate: result.agentEvaluation?.appropriate || false,
          agent_concern_level: result.agentEvaluation?.concernLevel || null,
          agent_reasoning: result.agentEvaluation?.reasoning || null,
          narrative_update: (result.narrativeUpdate?.shouldUpdate && result.narrativeUpdate?.newSummary) ? result.narrativeUpdate?.newSummary : null,
          agent_detected_items: result.agentEvaluation?.detectedItems || null,
        }).eq('id', agentMessageId)

        await supabase.from('contacts').update({
          evaluation: contact.evaluation as any || null,
          severity: contact.severity || null,
          lasteval: new Date().toISOString(),
          summary: contact.summary || null,
        }).eq('id', contact.id)


      } catch (error) {
        console.error("Error during Evaluation:", error)
      }
    },

    async log(l: AgentLog) {
      try {
        await supabase.from("logs").insert({
          ...l,
          execution: agent.execution,
          agent: agent.id as any,
          team_id: agent.parameters.team,
          session: agent.parameters.session,
          uid: agent.parameters.uid
        } as any)
      } catch (error) {
        console.error("Error logging agent event:", error)
      }
    },

    initializeWorker(config: WorkerConfig, handlers: NodeIO[], registry: WorkerRegistryItem, parameters: object = {}) {
      const worker = agent.addWorker(config)
      worker.registry = registry
      for (const h of handlers) {
        h.system = true
      }
      worker.addHandlers(handlers)
      return worker
    },

    addWorker(w: WorkerConfig): AIWorker {
      const nameType = w.type?.toUpperCase() || "NODE"
      w.id ||= `${nameType}_${ulid()}`
      w.handles ||= {}
      const worker = buildWorker(w)
      workers[w.id] = worker
      return worker
    },

    deleteWorker(id: string) {
      delete workers[id]
    },

    async resetAgent(uid: string, contactId?: string) {
      await supabase.from("states").delete().eq("id", uid)
      await supabase.from("history").delete().eq("uid", uid)
      await supabase.from("events").delete().eq("id", uid)
      if (contactId) {
        await supabase.from('contacts').update({
          evaluation: null,
          severity: 0,
          lasteval: null,
          summary: null,
        }).eq('id', contactId)
        await supabase.from("messages").delete().eq("contact", contactId)
      }
    },

  }

  return agent

}

export function configureAgent(data: AgentConfig) {

  const workers: WorkerConfig[] = (data.workers || []) as any
  const agent = createAgent(data)
  agent.type = data.type || "data"
  agent.description = data.description || ""
  agent.versions = data.versions || []
  agent.evalItems = data.config?.evalItems || []
  agent.escalationFlags = data.config?.escalation_flags || []

  for (const w of workers) {
    const { handles, ...rest } = w

    // console.log("Loading worker: ", w.type)

    const factory = (workerRegistry[w.type] as WorkerRegistryItem)
    if (!factory) continue

    const wrk = factory.create(agent)
    Object.assign(wrk.config, rest)

    wrk.parameters = w.parameters || {}
    wrk.condition = w.condition || {}

    for (const key in (handles as unknown as WorkerHandles)) {
      const h = handles[key] as NodeIO
      const existingHandler = wrk.fields[h.name]
      if (existingHandler) {
        existingHandler.id = h.id
        existingHandler.default = h.default
        continue
      }
      wrk.addHandler(h)
    }

    for (const key in wrk.handles) {
      const h = wrk.handles[key]
      delete wrk.handles[key]
      wrk.handles[h.id] = h
    }

  }

  for (const key in agent.workers) {
    const ew = agent.workers[key]
    delete agent.workers[key]
    agent.workers[ew.config.id] = ew
  }

  return agent


}
export function getAgentToSave(agent: Agent, team_id?: string) {

  const agentData: AgentConfig = {
    title: agent.title,
    description: agent.description,
    type: agent.type,
    edges: agent.edges,
    team_id,
    debuguuid: agent.debuguuid || "",
    config: {
      evalItems: agent.evalItems || [],
      escalation_flags: agent.escalationFlags || [],
    }
  }
  const workerlist = []

  for (const key in agent.workers) {
    const w = agent.workers[key].config
    const wc: WorkerConfig = {
      id: w.id,
      type: w.type,
      handles: {},
      x: w.x,
      y: w.y,
      parameters: w.parameters || {},
      condition: w.condition || {}
    }
    if (w.width && w.height) {
      wc.width = w.width
      wc.height = w.height
    }

    for (const key in w.handles) {
      const h = w.handles[key]
      delete h.value
      wc.handles[key] = h
    }

    workerlist.push(wc)


  }

  agentData.workers = workerlist

  return agentData

}


export function saveVersion(title: string, agent: Agent, team_id?: string) {

  const agentData = getAgentToSave(agent, team_id)
  const versions = agent.versions || []

  const version = {
    title,
    date: new Date().valueOf(),
    agent: agentData,
  }

  const serialized = JSON.parse(JSON.stringify(version))

  agent.versions = [serialized, ...versions]

}

export function loadVersion(version: number, agent: Agent) {

  const { versions, id } = agent
  const av = agent.versions[version]
  if (!av) return
  const nac = configureAgent(av.agent)
  nac.id = id
  nac.versions = versions
  return nac

}



export async function saveAgent(agent: Agent, team_id?: string) {

  const agentData = getAgentToSave(agent, team_id)
  agentData.versions = agent.versions
  agentData.config ||= {}
  agentData.config.evalItems = agent.evalItems || []
  agentData.config.escalation_flags = agent.escalationFlags || []

  if (agent.id) {
    await supabase.from("agents").update(agentData as any).eq("id", agent.id)
  } else {
    const { data } = await supabase.from("agents").insert(agentData as any).select()
    agent.id = data[0].id
  }

  return agent

}

export async function forkAgent(agent: Agent, team_id: string): Promise<Agent> {
  const agentData = getAgentToSave(agent, team_id)

  const forkedAgentData = {
    ...agentData,
    title: `Fork of ${agent.title || 'Untitled'}`,
    fork_id: agent.id,
    debuguuid: crypto.randomUUID(),
    versions: [],
    fork_base: JSON.parse(JSON.stringify(agentData)),
  }

  const { data, error } = await supabase
    .from("agents")
    .insert(forkedAgentData as any)
    .select()
    .single()

  if (error) {
    throw new Error(`Failed to fork agent: ${error.message}`)
  }

  const forkedAgent = configureAgent(data as any)
  return forkedAgent
}

function stableStringify(obj: unknown): string {
  if (obj === null || obj === undefined) return JSON.stringify(obj)
  if (Array.isArray(obj)) return "[" + obj.map(stableStringify).join(",") + "]"
  if (typeof obj === "object") {
    const keys = Object.keys(obj as Record<string, unknown>).sort()
    return "{" + keys.map(k => JSON.stringify(k) + ":" + stableStringify((obj as Record<string, unknown>)[k])).join(",") + "}"
  }
  return JSON.stringify(obj)
}

function deepEqual(a: unknown, b: unknown): boolean {
  return stableStringify(a) === stableStringify(b)
}

function workersListToMap(workers: WorkerConfig[]): Record<string, WorkerConfig> {
  const map: Record<string, WorkerConfig> = {}
  for (const w of workers) {
    if (w.id) map[w.id] = w
  }
  return map
}

function workersMapToList(workersMap: Record<string, WorkerConfig>): WorkerConfig[] {
  return Object.values(workersMap)
}

function threeWayMergeMap(
  base: Record<string, unknown>,
  current: Record<string, unknown>,
  incoming: Record<string, unknown>
): { merged: Record<string, unknown>, conflicts: string[] } {
  const merged: Record<string, unknown> = {}
  const conflicts: string[] = []
  const allKeys = new Set([...Object.keys(base), ...Object.keys(current), ...Object.keys(incoming)])

  for (const key of allKeys) {
    const inBase = key in base
    const inCurrent = key in current
    const inIncoming = key in incoming

    if (inBase && inCurrent && inIncoming) {
      const currentChanged = !deepEqual(base[key], current[key])
      const incomingChanged = !deepEqual(base[key], incoming[key])

      if (!currentChanged && !incomingChanged) {
        merged[key] = current[key]
      } else if (incomingChanged && !currentChanged) {
        merged[key] = incoming[key]
      } else if (currentChanged && !incomingChanged) {
        merged[key] = current[key]
      } else {
        if (deepEqual(current[key], incoming[key])) {
          merged[key] = current[key]
        } else {
          merged[key] = incoming[key]
          conflicts.push(key)
        }
      }
    } else if (!inBase && inIncoming && !inCurrent) {
      merged[key] = incoming[key]
    } else if (!inBase && !inIncoming && inCurrent) {
      merged[key] = current[key]
    } else if (!inBase && inIncoming && inCurrent) {
      if (deepEqual(current[key], incoming[key])) {
        merged[key] = current[key]
      } else {
        merged[key] = incoming[key]
        conflicts.push(key)
      }
    } else if (inBase && !inIncoming && inCurrent) {
      const currentChanged = !deepEqual(base[key], current[key])
      if (currentChanged) {
        merged[key] = current[key]
        conflicts.push(key)
      }
    } else if (inBase && inIncoming && !inCurrent) {
      const incomingChanged = !deepEqual(base[key], incoming[key])
      if (incomingChanged) {
        merged[key] = incoming[key]
        conflicts.push(key)
      }
    }
  }

  return { merged, conflicts }
}

function threeWayMergeScalar<T>(base: T, current: T, incoming: T): { value: T, conflict: boolean } {
  const currentChanged = !deepEqual(base, current)
  const incomingChanged = !deepEqual(base, incoming)

  if (!currentChanged && !incomingChanged) return { value: current, conflict: false }
  if (incomingChanged && !currentChanged) return { value: incoming, conflict: false }
  if (currentChanged && !incomingChanged) return { value: current, conflict: false }
  if (deepEqual(current, incoming)) return { value: current, conflict: false }
  return { value: incoming, conflict: true }
}

export async function mergeAgentIntoOriginal(forkedAgent: Agent, team_id: string): Promise<MergeResult> {
  if (!forkedAgent.fork_id) {
    throw new Error("This agent is not a fork")
  }

  const originalId = Number(forkedAgent.fork_id)
  const forkedId = forkedAgent.id

  const { data: originalData, error: fetchError } = await supabase
    .from("agents")
    .select("*")
    .eq("id", originalId)
    .eq("team_id", team_id)
    .single()

  if (fetchError || !originalData) {
    throw new Error("Original agent not found or not accessible")
  }

  const { data: forkDbData } = await supabase
    .from("agents")
    .select("fork_base")
    .eq("id", forkedId)
    .single()

  const forkBase = (forkDbData?.fork_base ?? null) as AgentConfig | null

  const originalAgent = configureAgent(originalData as any)
  originalAgent.versions = (originalData.versions || []) as AgentVersion[]
  saveVersion("Pre-merge snapshot", originalAgent, team_id)

  const forkedData = getAgentToSave(forkedAgent, team_id)

  const conflicts: MergeResult["conflicts"] = { workers: [], edges: [], fields: [] }
  let mergedWorkers: WorkerConfig[]
  let mergedEdges: object
  let mergedDescription: string | undefined
  let mergedType: AgentTypes | undefined

  if (forkBase) {
    const baseWorkers = workersListToMap((forkBase.workers || []) as WorkerConfig[])
    const currentWorkers = workersListToMap((originalData.workers || []) as unknown as WorkerConfig[])
    const incomingWorkers = workersListToMap((forkedData.workers || []) as WorkerConfig[])

    const workerMerge = threeWayMergeMap(
      baseWorkers as Record<string, unknown>,
      currentWorkers as Record<string, unknown>,
      incomingWorkers as Record<string, unknown>
    )
    mergedWorkers = workersMapToList(workerMerge.merged as Record<string, WorkerConfig>)
    conflicts.workers = workerMerge.conflicts

    const baseEdges = (forkBase.edges || {}) as Record<string, unknown>
    const currentEdges = (originalData.edges || {}) as Record<string, unknown>
    const incomingEdges = (forkedData.edges || {}) as Record<string, unknown>

    const edgeMerge = threeWayMergeMap(baseEdges, currentEdges, incomingEdges)
    mergedEdges = edgeMerge.merged
    conflicts.edges = edgeMerge.conflicts

    const descMerge = threeWayMergeScalar(
      forkBase.description ?? "",
      originalData.description ?? "",
      forkedData.description ?? ""
    )
    mergedDescription = descMerge.value
    if (descMerge.conflict) conflicts.fields.push("description")

    const typeMerge = threeWayMergeScalar(
      forkBase.type ?? "data",
      (originalData.type ?? "data") as AgentTypes,
      (forkedData.type ?? "data") as AgentTypes
    )
    mergedType = typeMerge.value
    if (typeMerge.conflict) conflicts.fields.push("type")
  } else {
    mergedWorkers = (forkedData.workers || []) as WorkerConfig[]
    mergedEdges = forkedData.edges || {}
    mergedDescription = forkedData.description
    mergedType = forkedData.type
  }

  const mergedData = {
    workers: mergedWorkers,
    edges: mergedEdges,
    description: mergedDescription,
    type: mergedType,
    title: originalData.title,
    debuguuid: originalData.debuguuid,
    versions: originalAgent.versions,
    team_id,
  }

  const { error: updateError } = await supabase
    .from("agents")
    .update(mergedData as any)
    .eq("id", originalId)

  if (updateError) {
    throw new Error(`Failed to merge agent: ${updateError.message}`)
  }

  if (forkedId) {
    const { error: deleteError } = await supabase
      .from("agents")
      .delete()
      .eq("id", forkedId)

    if (deleteError) {
      console.error("Failed to delete forked agent after merge:", deleteError.message)
    }
  }

  const hasConflicts = conflicts.workers.length > 0 || conflicts.edges.length > 0 || conflicts.fields.length > 0
  return { originalId, conflicts, hasConflicts }
}

export async function loadAgent(id: number, teamId: string): Promise<Agent | null> {

  if (!teamId) {
    throw new Error("No team ID provided")
  }

  const { data, error } = await supabase
    .from("agents")
    .select("*")
    .eq("id", id)
    .eq("team_id", teamId)
    .single()

  if (error) {
    if (error.code === 'PGRST116') {
      // No agent found - either doesn't exist or doesn't belong to selected team
      return null
    }
    throw error
  }

  if (!data) {
    return null
  }

  const agent = configureAgent(data as any)
  for (const key in agent.workers) {
    const w = agent.workers[key]
    if (w.config.type == "agentWorker" && w.parameters.agent) {
      await w.loadAgent(teamId)
    }
  }

  return agent
}
