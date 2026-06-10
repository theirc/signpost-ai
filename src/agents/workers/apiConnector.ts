import axios from 'axios'
import { z } from 'zod'
import { parseJsonHeaders, parseJsonParams, applyAuth, doHttpRequest, getOAuth2ClientCredentialsToken } from '../httpRequest'

declare global {
  interface ApiConnectorWorker extends AIWorker {
    fields: {
      body: NodeIO
      endpointUrlInput: NodeIO
      tool: NodeIO
      response: NodeIO
      error: NodeIO
    }
    parameters: {
      toolName?: string
      toolDescription?: string
      endpoint?: string
      method?: string
      params?: string
      paramsSchema?: string
      headers?: string
      timeout?: number
      authType?: string
      username?: string
      selectedKeyName?: string
      oauth2TokenUrl?: string
      oauth2ClientId?: string
      oauth2Scope?: string
      rateLimitPerMinute?: number
      maxRetries?: number
    }
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

async function resolveAuth(
  w: ApiConnectorWorker,
  p: AgentParameters,
  headers: Record<string, string>
): Promise<string | undefined> {
  const authType = w.parameters.authType || 'none'
  if (authType === 'none') return undefined

  const selectedKeyName = w.parameters.selectedKeyName || ''
  if (!selectedKeyName) {
    throw new Error(`Auth type '${authType}' selected, but no Stored Key Name chosen.`)
  }

  if (authType === 'oauth2_client_credentials') {
    const tokenUrl = (w.parameters.oauth2TokenUrl || '').trim()
    const clientId = (w.parameters.oauth2ClientId || '').trim()
    const clientSecret = (p.apiKeys as Record<string, string | undefined> | undefined)?.[selectedKeyName]
    if (!tokenUrl) throw new Error('OAuth2 Token URL is required for OAuth 2.0 Client Credentials.')
    if (!clientId) throw new Error('OAuth2 Client ID is required for OAuth 2.0 Client Credentials.')
    if (!clientSecret) throw new Error('Stored key for OAuth2 Client Secret is required.')

    const token = await getOAuth2ClientCredentialsToken(
      tokenUrl,
      clientId,
      clientSecret,
      (w.parameters.oauth2Scope || '').trim() || undefined,
      w.parameters.timeout || 10000
    )
    headers.Authorization = `Bearer ${token}`
    return token
  }

  if (authType === 'basic' && !w.parameters.username) {
    throw new Error('Username required for Basic Auth.')
  }

  const applied = applyAuth(
    authType,
    w.parameters.username,
    selectedKeyName,
    p.apiKeys as Record<string, string | undefined> | undefined,
    headers
  )
  if (!applied) {
    throw new Error(`Selected stored key "${selectedKeyName}" not found in environment variables or provided API keys.`)
  }
  return applied
}

async function execute(worker: ApiConnectorWorker, p: AgentParameters): Promise<void> {
  const logPrefix = `[API Connector (${worker.id})]`

  try {
    const runtimeEndpoint = worker.fields.endpointUrlInput?.value as string | undefined
    const fallbackEndpoint = worker.parameters.endpoint || ''
    const endpoint = runtimeEndpoint?.trim() || fallbackEndpoint
    if (!endpoint) {
      throw new Error("API endpoint is required. Provide it via the 'Endpoint URL' input handle or in the node parameters.")
    }

    const method = (worker.parameters.method || 'GET').toUpperCase()
    const params = parseJsonParams(worker.parameters.params || '{}')
    const headers = parseJsonHeaders(worker.parameters.headers || '{}')
    const timeout = worker.parameters.timeout || 10000
    const maxRetries = Math.min(Math.max(0, worker.parameters.maxRetries ?? 2), 5)
    const bodyValue = worker.fields.body.value

    const rateLimit = worker.parameters.rateLimitPerMinute ?? 60
    const rateKey = `api_connector:${worker.id}:${endpoint}`
    if (!checkRateLimit(rateKey, rateLimit)) {
      throw new Error(`Rate limit exceeded: max ${rateLimit} requests per minute`)
    }

    await resolveAuth(worker, p, headers)

    let data: unknown = undefined
    if (method !== 'GET' && bodyValue) {
      data = bodyValue
      if (!headers['Content-Type'] && typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
        headers['Content-Type'] = 'application/json'
      }
    }

    let lastError: Error | null = null
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const { data: apiResponseData, status, statusText } = await doHttpRequest({
          url: endpoint,
          method,
          headers,
          params: params as Record<string, unknown>,
          data,
          timeout
        })

        worker.fields.error.value = ''

        if (status >= 200 && status < 300) {
          worker.fields.response.value = apiResponseData !== undefined && apiResponseData !== null
            ? (typeof apiResponseData === 'object' ? JSON.stringify(apiResponseData, null, 2) : String(apiResponseData))
            : `Request successful: ${status} ${statusText || ''}`
          return
        }

        if (status === 429 || status >= 500) {
          lastError = new Error(`HTTP ${status} ${statusText}`)
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)))
            continue
          }
        }

        const errorDataString = apiResponseData
          ? (typeof apiResponseData === 'object' ? JSON.stringify(apiResponseData) : String(apiResponseData))
          : ''
        const errorMsg = `Request failed with status code ${status} (${statusText || 'Error'})`
        worker.fields.error.value = errorDataString ? `${errorMsg} (Response Data: ${errorDataString})` : errorMsg
        worker.fields.response.value = ''
        return
      } catch (err) {
        lastError = err instanceof Error ? err : new Error(String(err))
        if (attempt < maxRetries) {
          await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)))
        }
      }
    }

    throw lastError || new Error('Request failed after retries')
  } catch (error) {
    console.error(`${logPrefix} - Error:`, error)
    worker.fields.response.value = ''
    let errorMessage = 'An unknown error occurred.'
    if (axios.isAxiosError(error)) {
      errorMessage = error.response
        ? `Request failed with status code ${error.response.status} (${error.response.statusText || 'Error'})`
        : error.request
          ? `No response received: ${error.message}`
          : error.message
      if (error.response?.data) {
        try { errorMessage += ` (Response Data: ${typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)})` }
        catch { /* ignore */ }
      }
    } else if (error instanceof Error) {
      errorMessage = error.message
    } else {
      try { errorMessage = JSON.stringify(error) } catch { errorMessage = String(error) }
    }
    worker.fields.error.value = errorMessage
  }
}

function getTool(w: ApiConnectorWorker, p: AgentParameters): ToolConfig {
  const toolName = (w.parameters.toolName || 'api_call').trim().replace(/\s+/g, '_')
  const toolDescription = w.parameters.toolDescription || 'Call an external HTTP API'
  const paramsSchema = buildZodSchema(w.parameters.paramsSchema || '[]')

  return {
    name: toolName,
    description: toolDescription,
    parameters: paramsSchema,
    async execute(args: Record<string, unknown>): Promise<string> {
      const endpoint = w.parameters.endpoint || ''
      if (!endpoint.trim()) {
        return JSON.stringify({ error: 'Endpoint URL is required' })
      }

      const rateLimit = w.parameters.rateLimitPerMinute ?? 60
      const rateKey = `api_connector:${w.id}:${endpoint}`
      if (!checkRateLimit(rateKey, rateLimit)) {
        return JSON.stringify({ error: `Rate limit exceeded: max ${rateLimit} requests per minute` })
      }

      const timeout = w.parameters.timeout || 10000
      const maxRetries = Math.min(Math.max(0, w.parameters.maxRetries ?? 2), 5)
      const headers = parseJsonHeaders(w.parameters.headers || '{}')

      try {
        await resolveAuth(w, p, headers)
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        if (p.agent?.log) p.agent.log({ type: 'error', message: msg, worker: w.type, workerId: w.id })
        return JSON.stringify({ error: msg })
      }

      let url = endpoint
      const params: Record<string, unknown> = {}
      for (const [key, value] of Object.entries(args)) {
        if (value === undefined || value === null) continue
        if (url.includes(`{${key}}`)) {
          url = url.replace(`{${key}}`, String(value))
        } else {
          params[key] = value
        }
      }

      const staticParams = parseJsonParams(w.parameters.params || '{}')
      const method = (w.parameters.method || 'GET').toUpperCase() as 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
      const sendsBody = method === 'POST' || method === 'PUT' || method === 'PATCH'

      let requestParams: Record<string, unknown> = {}
      let requestData: unknown = undefined
      if (sendsBody) {
        requestData = { ...staticParams, ...params }
        if (Object.keys(headers).every(k => k.toLowerCase() !== 'content-type')) {
          headers['Content-Type'] = 'application/json'
        }
      } else {
        Object.assign(params, staticParams)
        requestParams = params
      }

      if (p.agent?.log) {
        p.agent.log({
          type: 'tool_start',
          worker: w.type,
          workerId: w.id,
          message: `Calling ${method} ${endpoint}`,
          handles: {},
          parameters: { toolName, args: Object.keys(args) }
        })
      }

      let lastError: Error | null = null
      for (let attempt = 0; attempt <= maxRetries; attempt++) {
        try {
          const { data, status, statusText } = await doHttpRequest({
            url,
            method,
            headers,
            params: requestParams,
            data: requestData,
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
            w.fields.response.value = result
            return result
          }

          if (status === 429 || status >= 500) {
            lastError = new Error(`HTTP ${status} ${statusText}`)
            if (attempt < maxRetries) {
              await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)))
              continue
            }
          }

          const errMsg = typeof data === 'object' ? JSON.stringify(data) : String(data)
          const errorResult = JSON.stringify({ error: `HTTP ${status}: ${errMsg}` })
          w.fields.error.value = errorResult
          return errorResult
        } catch (err) {
          lastError = err instanceof Error ? err : new Error(String(err))
          if (attempt < maxRetries) {
            await new Promise(r => setTimeout(r, Math.min(1000 * Math.pow(2, attempt), 10000)))
          } else {
            const msg = axios.isAxiosError(lastError)
              ? (lastError.response ? `HTTP ${lastError.response.status}` : lastError.message)
              : lastError?.message || 'Unknown error'
            if (p.agent?.log) {
              p.agent.log({ type: 'error', message: msg, worker: w.type, workerId: w.id })
            }
            const errorResult = JSON.stringify({ error: msg })
            w.fields.error.value = errorResult
            return errorResult
          }
        }
      }
      const errorResult = JSON.stringify({ error: lastError?.message || 'Request failed' })
      w.fields.error.value = errorResult
      return errorResult
    }
  }
}

function create(agent: Agent) {
  const worker = agent.initializeWorker(
    {
      type: 'apiConnector',
      conditionable: true,
      parameters: {
        toolName: 'api_call',
        toolDescription: 'Call an external HTTP API',
        endpoint: '',
        method: 'GET',
        params: '{}',
        paramsSchema: '[]',
        headers: '{}',
        timeout: 10000,
        authType: 'none',
        username: '',
        selectedKeyName: '',
        oauth2TokenUrl: '',
        oauth2ClientId: '',
        oauth2Scope: '',
        rateLimitPerMinute: 60,
        maxRetries: 2
      }
    },
    [
      { type: 'string', direction: 'input', title: 'Body', name: 'body' },
      { type: 'string', direction: 'input', title: 'Endpoint URL', name: 'endpointUrlInput' },
      { type: 'tool', direction: 'input', title: 'Tool', name: 'tool' },
      { type: 'string', direction: 'output', title: 'Response', name: 'response' },
      { type: 'string', direction: 'output', title: 'Error', name: 'error' },
    ],
    apiConnector
  ) as ApiConnectorWorker
  worker.getTool = getTool
  return worker
}

export const apiConnector: WorkerRegistryItem = {
  title: 'API',
  type: 'apiConnector',
  category: 'tool',
  description: 'Unified API worker: standalone HTTP calls and LLM tool-callable endpoints with auth, rate limiting, retries, and OAuth2.',
  execute,
  create,
  get registry() { return apiConnector }
}
