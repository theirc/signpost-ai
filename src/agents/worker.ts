import { ulid } from "ulid"
import { loadAgent } from "./agentfactory"

export const inputOutputTypes = {
  string: "Text",
  "string[]": "Text List",
  number: "Number",
  "number[]": "Number List",
  enum: "Enumeration",
  boolean: "Boolean",
  unknown: "Unknown",
  doc: "Documents",
  references: "References",
  chat: "Chat",
  json: "JSON",
  audio: "Audio",
  // image: "Image",
  // video: "Video",
  // execute: "Execute",
}

interface WorkerCondition {
  operator?: "equals" | "notEquals" | "gt" | "lt" | "gte" | "lte" | "between" | "contains" | "notContains"
  value?: any
  value2?: any // For "between" operator
}

declare global {

  type AIWorker = ReturnType<typeof buildWorker>

  type WorkerHandles = { [index: string]: NodeIO }
  type IOTypes = keyof typeof inputOutputTypes

  interface NodeIO {
    id?: string
    title?: string
    name: string
    prompt?: string
    direction: "output" | "input"
    type: IOTypes
    enum?: string[]
    system?: boolean
    condition?: boolean
    value?: any
    default?: any
    mock?: string | number
  }

  interface WorkerConfig {
    id?: string
    handles?: WorkerHandles
    type: WorkerTypes
    parameters?: object
    x?: number
    y?: number
    condition?: WorkerCondition
  }
}


export function buildWorker(w: WorkerConfig) {

  w.handles = w.handles || {}
  w.condition ||= {}
  const fields: { [index: string]: NodeIO } = {}

  const worker = {
    config: w,
    lastUpdate: 0,
    registry: null as WorkerRegistryItem,
    executed: false,
    error: null as string,

    referencedAgent: null, //this cannot be typed because it causes circular references. Cast to Agent when needed

    get id() {
      return w.id
    },

    set id(v: string) {
      w.id = v
    },

    get handles() {
      return w.handles
    },

    get handlersArray() {
      return Object.values(w.handles || {}) as NodeIO[]
    },

    get condition() {
      return w.condition
    },
    set condition(v: WorkerCondition) {
      w.condition = v
    },

    parameters: w.parameters as any || {},
    values: {},
    fields,

    async execute(p: AgentParameters) {
      worker.error = null
      if (worker.executed) return
      worker.executed = true

      await worker.getValues(p)

      console.log("Worker - Executing: ", w.type)
      p.logWriter({
        worker,
        state: p.state,
      })

      const cond = Object.values(worker.handles).filter(h => h.condition)[0]
      if (cond) {
        // console.log("Worker - Condition: ", cond)
        const conditionMet = worker.evaluateCondition(cond.value)
        if (!conditionMet) {
          console.log(`Worker ${w.type} - Condition not met`)
          worker.updateWorker()
          p.agent.currentWorker = null
          p.agent.update()
          return
        }
      }

      p.agent.currentWorker = worker
      worker.updateWorker()
      p.agent.update()

      worker.error = null

      try {
        await worker.registry.execute(worker, p)
      } catch (error) {
        error = error.toString()
        worker.error = error
        throw error
      }

      p.agent.update()
      worker.updateWorker()
      p.agent.currentWorker = null
      p.agent.update()

    },

    evaluateCondition(condValue: any): boolean {
      const { operator, value, value2 } = worker.condition

      if (operator === "equals") {
        return condValue === value
      }

      if (operator === "notEquals") {
        return condValue !== value
      }

      // String operators
      if (typeof condValue === "string" && typeof value === "string") {
        if (operator === "contains") {
          return condValue.includes(value)
        }
        if (operator === "notContains") {
          return !condValue.includes(value)
        }
      }

      // Number operators
      if (typeof condValue === "number" && typeof value === "number") {
        if (operator === "gt") {
          return condValue > value
        }
        if (operator === "lt") {
          return condValue < value
        }
        if (operator === "gte") {
          return condValue >= value
        }
        if (operator === "lte") {
          return condValue <= value
        }
        if (operator === "between" && typeof value2 === "number") {
          return condValue >= value && condValue <= value2
        }
      }

      // Boolean fallback (for backward compatibility)
      return (!!value) === (!!condValue)
    },

    async getValues(p: AgentParameters) {
      const connw = worker.getConnectedWokers(p)
      for (const { worker, source, target } of connw) {
        await worker.execute(p)
        if (target.value === undefined) {
          target.value = source.value || target.default
        }
      }
    },

    getConnectedHandlers(h: NodeIO, curAgent: any) {
      const agent: Agent = curAgent
      const { workers } = agent

      const connected: AIWorker[] = []
      const connwh: NodeIO[] = []

      for (const e of Object.values(agent.edges)) {
        if (h && e.targetHandle !== h.id) continue
        if (e.targetHandle in w.handles) {
          const cw = workers[e.source]
          connected.push(cw)
          connwh.push(cw.handles[e.sourceHandle],)
        }
      }
      return connwh
    },

    getInputHandlersByName() {
      const handlers: { [index: string]: NodeIO } = {}
      for (const e of Object.values(worker.handles)) {
        if (e.direction === "input") {
          handlers[e.name] = e
        }
      }
      return handlers
    },
    getOutputHandlersByName() {
      const handlers: { [index: string]: NodeIO } = {}
      for (const e of Object.values(worker.handles)) {
        if (e.direction === "output") {
          handlers[e.name] = e
        }
      }
      return handlers
    },

    getConnectedHandler(h: NodeIO, curAgent: any) {
      return worker.getConnectedHandlers(h, curAgent)[0] || null
    },


    inferType(h: NodeIO, curAgent: any): IOTypes {
      const c = worker.getConnectedHandler(h, curAgent)
      return c?.type || "unknown"
    },

    getConnectedWokers(p: AgentParameters) {
      const { agent, agent: { workers } } = p

      const connected: AIWorker[] = []
      const connwh: { worker: AIWorker, source: NodeIO, target: NodeIO }[] = []

      for (const e of Object.values(agent.edges)) {
        if (e.targetHandle in w.handles) {
          const cw = workers[e.source]
          connected.push(cw)
          connwh.push({
            worker: cw,
            source: cw.handles[e.sourceHandle],
            target: w.handles[e.targetHandle]
          })

        }
      }
      return connwh
    },

    updateWorker() {
      worker.lastUpdate++ // = Date.now().valueOf()
    },

    addHandler(h: NodeIO): NodeIO {
      if (!h.id) h.id = ulid()
      w.handles[h.id] = h
      fields[h.name] = h
      worker.lastUpdate++ //= Date.now().valueOf()
      return h
    },

    createHandlerId() {
      return ulid()
    },

    addHandlers(handlers: NodeIO[]) {
      for (const h of handlers) {
        worker.addHandler(h)
      }
    },

    updateHandler(id: string, h: Partial<NodeIO>) {
      if (w.handles[id]) {
        Object.assign(w.handles[id], h)
      }
      worker.lastUpdate++ // = Date.now().valueOf()
    },

    upsertHandler(id: string, h: Partial<NodeIO>) {
      if (id) {
        worker.updateHandler(id, h)
      } else {
        worker.addHandler(h as NodeIO)
      }
    },

    deleteHandler(id: string) {
      delete w.handles[id]
      worker.lastUpdate++ // = Date.now().valueOf()
    },

    getUserHandlers() {
      return Object.values(w.handles || {}).filter(h => !h.system)
    },

    async loadAgent() {
      if (!worker.parameters || !worker.parameters.agent) return
      const agent = await loadAgent(worker.parameters.agent)
      const inp = agent.getInputWorker()
      const out = agent.getResponseWorker()
      if (!inp || !out) return

      worker.referencedAgent = agent
      w.handles = {}

      for (const h of Object.values(inp.handles)) {
        h.direction = "input"
        worker.addHandler(h)
      }
      for (const h of Object.values(out.handles)) {
        h.direction = "output"
        worker.addHandler(h)
      }

      worker.updateWorker()
      console.log("Worker Referenced Agent Loaded: ", worker.referencedAgent)
    },


  }

  return worker
}
