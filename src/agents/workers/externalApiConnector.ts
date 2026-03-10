import axios from 'axios'
import { z } from 'zod'
import { parseJsonHeaders, parseJsonParams, applyAuth, doHttpRequest } from '../httpRequest'

declare global {
  interface ExternalApiConnectorWorker extends AIWorker {
    fields: {
      tool: NodeIO
      response: NodeIO
      error: NodeIO
    }
    parameters: {
      toolName?: string
      toolDescription?: string
      endpoint?: string
      params?: string
      paramsSchema?: string
      headers?: string
      timeout?: number
      authType?: string
      username?: string
      selectedKeyName?: string
      rateLimitPerMinute?: number
      maxRetries?: number
    }
  }

  interface ParamSchemaItem {
    name: string
    type: 'string' | 'number' | 'boolean' | 'array' | 'object'
    description?: string
    required?: boolean
  }
}

const rateLimitStore = new Map<string, number[]>()
const RATE_LIMIT_WINDOW_MS = 60_000

function checkRateLimit(key: string, limit: number): boolean {
  if (limit <= 0) return true
  const now = Date.now()
  let timestamps = rateLimitStore.get(key) || []
  timestamps = timestamps.filter(t => now - t < RATE_LIMIT_WINDOW_MS)
  if (timestamps.length >= limit) return false
  timestamps.push(now)
  rateLimitStore.set(key, timestamps)
  return true
}

function buildZodSchema(paramsSchemaJson: string): z.ZodObject<any> {
  let items: ParamSchemaItem[] = []
  try {
    const parsed = JSON.parse(paramsSchemaJson || '[]')
    items = Array.isArray(parsed) ? parsed : []
  } catch {
    return z.object({})
  }
  const shape: Record<string, z.ZodTypeAny> = {}
  for (const item of items) {
    let schema: z.ZodTypeAny
    switch (item.type) {
      case 'string':
        schema = z.string().describe(item.description || item.name)
        break
      case 'number':
        schema = z.number().describe(item.description || item.name)
        break
      case 'boolean':
        schema = z.boolean().describe(item.description || item.name)
        break
      case 'array':
        schema = z.array(z.any()).describe(item.description || item.name)
        break
      case 'object':
        schema = z.record(z.any()).describe(item.description || item.name)
        break
      default:
        schema = z.string().describe(item.description || item.name)
    }
    shape[item.name] = item.required !== false ? schema : schema.optional()
  }
  return z.object(shape)
}

async function execute(worker: ExternalApiConnectorWorker, p: AgentParameters): Promise<void> {
  worker.fields.response.value = ''
  worker.fields.error.value = ''
}

function getTool(w: ExternalApiConnectorWorker, p: AgentParameters): ToolConfig {
  const toolName = (w.parameters.toolName || 'external_api').trim().replace(/\s+/g, '_')
  const toolDescription = w.parameters.toolDescription || 'Call an external HTTP API'
  const paramsSchema = buildZodSchema(w.parameters.paramsSchema || '[]')

  return {
    name: toolName,
    description: toolDescription,
    parameters: paramsSchema,
    async execute(args: Record<string, unknown>, ctx?: Record<string, unknown>): Promise<string> {
      const logPrefix = `[External API Connector (${w.id})]`
      const endpoint = w.parameters.endpoint || ''
      if (!endpoint.trim()) {
        const err = 'Endpoint URL is required'
        if (p.agent?.log) p.agent.log({ type: 'error', message: err, worker: w.type, workerId: w.id })
        return JSON.stringify({ error: err })
      }

      const rateLimit = w.parameters.rateLimitPerMinute ?? 60
      const rateKey = `external_api:${w.id}:${endpoint}`
      if (!checkRateLimit(rateKey, rateLimit)) {
        const err = `Rate limit exceeded: max ${rateLimit} requests per minute`
        if (p.agent?.log) p.agent.log({ type: 'error', message: err, worker: w.type, workerId: w.id })
        return JSON.stringify({ error: err })
      }

      const timeout = w.parameters.timeout || 10000
      const maxRetries = Math.min(Math.max(0, w.parameters.maxRetries ?? 2), 5)
      const headers = parseJsonHeaders(w.parameters.headers || '{}')
      const authType = w.parameters.authType || 'none'
      if (authType === 'basic' && !w.parameters.username) {
        return JSON.stringify({ error: 'Username required for Basic Auth.' })
      }
      if (authType !== 'none' && w.parameters.selectedKeyName) {
        const applied = applyAuth(
          authType,
          w.parameters.username,
          w.parameters.selectedKeyName,
          p.apiKeys as Record<string, string | undefined> | undefined,
          headers
        )
        if (!applied) {
          const err = `Auth key "${w.parameters.selectedKeyName}" not found`
          return JSON.stringify({ error: err })
        }
      }

      let url = endpoint
      const params: Record<string, unknown> = {}
      const pathArgs: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(args)) {
        if (value === undefined || value === null) continue
        if (url.includes(`{${key}}`)) {
          pathArgs[key] = value
        } else {
          params[key] = value
        }
      }
      for (const [key, value] of Object.entries(pathArgs)) {
        url = url.replace(`{${key}}`, String(value))
      }

      const staticParams = parseJsonParams(w.parameters.params || '{}')
      Object.assign(params, staticParams)

      if (p.agent?.log) {
        p.agent.log({
          type: 'tool_start',
          worker: w.type,
          workerId: w.id,
          message: `Calling GET ${endpoint}`,
          handles: {},
          parameters: { toolName, args: Object.keys(args) }
        })
      }

      let lastError: Error | null = null
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const { data, status, statusText } = await doHttpRequest({
            url,
            method: 'GET',
            headers,
            params,
            timeout
          })
          if (status >= 200 && status < 300) {
            const result = typeof data === 'object' ? JSON.stringify(data, null, 2) : String(data)
            if (p.agent?.log) {
              p.agent.log({
                type: 'tool_end',
                worker: w.type,
                workerId: w.id,
                message: `Success ${status}`,
                handles: {},
                parameters: { toolName, status }
              })
            }
            return result
          }
          if (status === 429 || status >= 500) {
            lastError = new Error(`HTTP ${status} ${statusText}`)
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
            await new Promise(r => setTimeout(r, delay))
            continue
          }
          const errMsg = typeof data === 'object' ? JSON.stringify(data) : String(data)
          return JSON.stringify({ error: `HTTP ${status}: ${errMsg}` })
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          if (attempt < maxRetries) {
            const delay = Math.min(1000 * Math.pow(2, attempt), 10000)
            await new Promise(r => setTimeout(r, delay))
          } else {
            const msg = axios.isAxiosError(lastError)
              ? (lastError.response ? `HTTP ${lastError.response.status}` : lastError.message)
              : lastError?.message || 'Unknown error'
            if (p.agent?.log) {
              p.agent.log({ type: 'error', message: msg, worker: w.type, workerId: w.id })
            }
            return JSON.stringify({ error: msg })
          }
        }
      }
      return JSON.stringify({ error: lastError?.message || 'Request failed' })
    }
  }
}

function create(agent: Agent) {
  const worker = agent.initializeWorker(
    {
      type: "externalApiConnector",
      conditionable: false,
      parameters: {
        toolName: 'external_api',
        toolDescription: 'Call an external HTTP API',
        endpoint: '',
        params: '{}',
        paramsSchema: '[]',
        headers: '{}',
        timeout: 10000,
        authType: 'none',
        username: '',
        selectedKeyName: '',
        rateLimitPerMinute: 60,
        maxRetries: 2
      }
    },
    [
      { type: "tool", direction: "input", title: "Tool", name: "tool" },
      { type: "string", direction: "output", title: "Response", name: "response" },
      { type: "string", direction: "output", title: "Error", name: "error" }
    ],
    externalApiConnector
  ) as ExternalApiConnectorWorker
  worker.getTool = getTool
  return worker
}

export const externalApiConnector: WorkerRegistryItem = {
  title: "External API Connector",
  type: "externalApiConnector",
  category: "tool",
  description: "Converts HTTP endpoints into agent-callable tools with configurable schemas, auth, rate limiting, and retries",
  execute,
  create,
  get registry() { return externalApiConnector }
}
