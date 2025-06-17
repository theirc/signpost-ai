import { supabase } from "./db"
import { workerRegistry } from "./registry"
import { buildWorker } from "./worker"
import { ulid } from 'ulid'
import { ApiWorker } from "./workers/api"
import { z } from "zod"


interface AgentConfig {
  edges?: object
  id?: number
  title?: string
  description?: string
  type?: AgentTypes
  workers?: object
  team_id?: string
  debuguuid?: string
}

declare global {
  type AgentTypes = "conversational" | "data"
}


export function createAgent(config: AgentConfig) {

  const workers: { [index: string]: AIWorker } = {}
  const edges: EdgeConnections = (config.edges as EdgeConnections) || {}

  const agent = {

    get id() { return config.id },
    set id(v: number) { config.id = v },
    get title() { return config.title },
    set title(v: string) { config.title = v },
    edges,
    workers,
    displayData: false,

    type: "data" as AgentTypes,
    debuguuid: config.debuguuid || "",
    description: "",


    currentWorker: null as AIWorker,
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
      for (const key in workers) {
        const w = workers[key]
        w.executed = false
        w.error = null
        for (const key in w.handles) {
          const h = w.handles[key]
          // if (h.persistent) continue
          h.value = h.default || undefined
        }
      }
    },

    async execute(p: AgentParameters) {
      agent.reset()
      p.input ||= {}
      p.output ||= {}
      p.input ||= {}
      p.output ||= {}
      p.apikeys ||= {}
      p.state ||= {}
      p.logWriter ||= () => { }
      p.agent = agent

      if (p.debug && agent.debuguuid && !p.uid) {
        p.uid = agent.debuguuid
      }

      const hasUid = p.uid && z.string().uuid().safeParse(p.uid).success

      if (hasUid) {
        const dbState = await supabase.from("states").select("*").eq("id", p.uid).single()
        if (dbState.data) p.state = dbState.data.state || {}
      }

      console.log(`Executing agent '${agent.title}'`)

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
        console.error(error)
        p.error = error.toString()
      }

      agent.currentWorker = null
      agent.update()
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
  }

  return agent

}

export function configureAgent(data: AgentConfig) {

  const workers: WorkerConfig[] = (data.workers || []) as any
  const agent = createAgent(data)
  agent.type = data.type || "data"
  agent.description = data.description || ""

  for (const w of workers) {
    const { handles, ...rest } = w

    console.log("Loading worker: ", w.type)

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

export async function saveAgent(agent: Agent, team_id?: string) {

  const agentData: AgentConfig = {
    title: agent.title,
    description: agent.description,
    type: agent.type,
    edges: agent.edges,
    team_id,
    debuguuid: agent.debuguuid || "",
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
    for (const key in w.handles) {
      const h = w.handles[key]
      delete h.value
      delete h.value
      wc.handles[key] = h
    }

    workerlist.push(wc)


  }

  agentData.workers = workerlist


  if (agent.id) {
    await supabase.from("agents").update(agentData as any).eq("id", agent.id)
  } else {
    const { data } = await supabase.from("agents").insert(agentData as any).select()
    agent.id = data[0].id
  }

  return agent

}

export async function loadAgent(id: number): Promise<Agent> {
  console.log("Loading agent: ", id)
  const { data } = await supabase.from("agents").select("*").eq("id", id).single()
  const agent = configureAgent(data as any)

  for (const key in agent.workers) {
    const w = agent.workers[key]
    if (w.config.type == "agentWorker" && w.parameters.agent) {
      await w.loadAgent()
    }
  }

  return agent
}
