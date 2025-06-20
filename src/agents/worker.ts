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
  handoff: "Handoff",
}

interface WorkerCondition {
  operator?: WorkerOperators
  value?: any
  value2?: any // For "between" operator
}

declare global {

  type AIWorker = ReturnType<typeof buildWorker>

  type WorkerHandles = { [index: string]: NodeIO }
  type IOTypes = keyof typeof inputOutputTypes

  type WorkerOperators = "equals" | "notEquals" | "gt" | "lt" | "gte" | "lte" | "between" | "contains" | "notContains" | "isEmpty" | "isNotEmpty"

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
    operator?: WorkerOperators
    conditionValue1?: any
    conditionValue2?: any
  }

  interface WorkerConfig {
    id?: string
    handles?: WorkerHandles
    type: WorkerTypes
    parameters?: object
    x?: number
    y?: number
    width?: number
    height?: number
    condition?: WorkerCondition
    conditionable?: boolean
    state?: any
  }
}


export function buildWorker(w: WorkerConfig) {

  w.handles = w.handles || {}
  const fields: { [index: string]: NodeIO } = {}

  const worker = {
    config: w,
    lastUpdate: 0,
    registry: null as WorkerRegistryItem,
    executed: false,
    error: null as string,
    get conditionable() {
      return w.conditionable
    },

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
    state: {},
    values: {},
    fields,

    async execute(p: AgentParameters) {
      worker.error = null
      if (worker.executed) return
      worker.executed = true

      if (!p.state.workers) {
        p.state.workers = {}
      }
      
      worker.state = p.state.workers[worker.id] || {}

      await worker.getValues(p)

      console.log("Worker - Executing: ", w.type)
      p.logWriter({
        worker,
        state: p.state,
      })

      const conditions = worker.handlersArray.filter(h => h.condition)

      if (conditions.length > 0) {

        let someConditionsMet = false

        for (const cond of conditions) {
          console.log(`Worker '${w.type}' condition:`, cond)
          const conditionMet = worker.evaluateCondition(cond)
          if (conditionMet) {
            someConditionsMet = true
            break
          }
          // allConditionsMet = allConditionsMet && conditionMet
        }
        if (!someConditionsMet) {
          console.log(`Worker '${w.type}' - Conditions not met`)
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

      p.state.workers[worker.id] = worker.state || {}

      p.agent.update()
      worker.updateWorker()
      p.agent.currentWorker = null
      p.agent.update()

    },

    evaluateCondition(handle: NodeIO): boolean {
      let { value, conditionValue1, conditionValue2, operator, type } = handle

      if (type === "boolean") {
        value = !!value
        conditionValue1 = !!conditionValue1
        if (operator === "equals") return conditionValue1 == value
        if (operator === "notEquals") return conditionValue1 != value
      }

      if (type === "string" || type === "enum") {
        value ||= ""
        conditionValue1 ||= ""
        if (typeof value !== "string") value = String(value)
        if (typeof conditionValue1 !== "string") conditionValue1 = String(conditionValue1)

        if (operator === "equals") return conditionValue1 == value
        if (operator === "notEquals") return conditionValue1 != value
        if (operator === "contains") return conditionValue1.includes(value)
        if (operator === "notContains") return !conditionValue1.includes(value)
        if (operator === "isEmpty") return value == ""
        if (operator === "isNotEmpty") return value != ""
      }

      if (type === "number") {
        if (typeof value !== "number") value = Number(value)
        if (typeof conditionValue1 !== "number") conditionValue1 = Number(conditionValue1)
        if (conditionValue2 && typeof conditionValue2 !== "number") conditionValue2 = Number(conditionValue2)
        if (value) value = 0
        if (conditionValue1) conditionValue1 = 0
        if (conditionValue2) conditionValue2 = 0
        if (operator === "equals") return conditionValue1 == value
        if (operator === "notEquals") return conditionValue1 != value
        if (operator === "gt") return value > conditionValue1
        if (operator === "lt") return value < conditionValue1
        if (operator === "gte") return value >= conditionValue1
        if (operator === "lte") return value <= conditionValue1
        if (operator === "between") return value >= conditionValue1 && value <= conditionValue2
      }
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

      const connwh: { worker: AIWorker, source: NodeIO, target: NodeIO }[] = []

      for (const e of Object.values(agent.edges)) {
        if (e.targetHandle in w.handles) {
          const cw = workers[e.source]
          const source = cw.handles[e.sourceHandle]
          const target = w.handles[e.targetHandle]
          connwh.push({
            worker: cw,
            source,
            target,
          })

        }
      }
      return connwh
    },

    getConnectedWokersToHandle(h: NodeIO, p: AgentParameters) {
      const { agent, agent: { workers } } = p

      const connwh: AIWorker[] = []
      if (!h) return connwh

      const addedWorkers: { [index: string]: AIWorker } = {}

      for (const e of Object.values(agent.edges)) {
        if (e.targetHandle === h.id) {
          const cw = workers[e.source]
          if (!cw || addedWorkers[cw.id]) continue
          addedWorkers[cw.id] = cw
          connwh.push(cw)
        }
        if (e.sourceHandle === h.id) {
          const cw = workers[e.target]
          if (!cw || addedWorkers[cw.id]) continue
          addedWorkers[cw.id] = cw
          connwh.push(cw)
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

    getHandlersArray() {
      return Object.values(w.handles || {})
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
