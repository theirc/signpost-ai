import axios from 'axios'
import { parseJsonParams, parseJsonHeaders, applyAuth, doHttpRequest } from '../httpRequest'

export interface ApiWorker extends AIWorker {
  fields: {
    body: NodeIO
    response: NodeIO
    error: NodeIO
    endpointUrlInput: NodeIO // Added new input field handle
  }
  parameters: {
    endpoint?: string // This is the fallback endpoint
    method?: string
    params?: string
    headers?: string
    timeout?: number
    authType?: string
    username?: string
    selectedKeyName?: string // Keep this to select WHICH global key to use
    // localApiKeys?: { [keyName: string]: string } // REMOVED insecure local key storage
  }
}

function create(agent: Agent) {
  const worker = agent.initializeWorker(
    {
      type: "api",
      conditionable: true,
      parameters: {
        // REMOVED localApiKeys: {}, 
        endpoint: '',
        method: 'GET',
        params: '{}',
        headers: '{}',
        timeout: 10000,
        authType: 'none',
        username: '',
        selectedKeyName: ''
      }
    },
    [
      { type: "string", direction: "input", title: "Body", name: "body" },
      { type: "string", direction: "output", title: "Response", name: "response" },
      { type: "string", direction: "output", title: "Error", name: "error" },
      { type: "string", direction: "input", title: "Endpoint URL", name: "endpointUrlInput" },
    ],
    api
  )
  return worker
}

async function execute(worker: ApiWorker, p: AgentParameters) {
  const logPrefix = `[API Worker (${worker.id})]`

  try {
    // --- Common Setup --- 
    const runtimeEndpoint = worker.fields.endpointUrlInput?.value as string | undefined
    const fallbackEndpoint = worker.parameters.endpoint || ''
    const endpoint = runtimeEndpoint && runtimeEndpoint.trim() !== '' ? runtimeEndpoint.trim() : fallbackEndpoint

    if (!endpoint) {
      console.error(`${logPrefix} - Endpoint is missing!`)
      throw new Error("API endpoint is required. Provide it either via the 'Endpoint URL' input handle or in the node parameters.")
    }

    const method = (worker.parameters.method || 'GET').toUpperCase()
    const params = parseJsonParams(worker.parameters.params || '{}')
    const headers = parseJsonHeaders(worker.parameters.headers || '{}')
    const timeout = worker.parameters.timeout || 10000
    const authType = worker.parameters.authType || 'none'
    const username = worker.parameters.username
    const selectedKeyName = worker.parameters.selectedKeyName || ''
    const bodyValue = worker.fields.body.value

    if (authType !== 'none') {
      if (!selectedKeyName) {
        throw new Error(`Auth type '${authType}' selected, but no Stored Key Name chosen.`)
      }
      const applied = applyAuth(authType, username, selectedKeyName, p.apiKeys as Record<string, string | undefined> | undefined, headers)
      if (!applied && authType === 'basic' && !username) {
        throw new Error("Username required for Basic Auth.")
      }
      if (!applied) {
        throw new Error(`Selected stored key "${selectedKeyName}" not found in environment variables or provided AgentParameters.apikeys.`)
      }
    }

    let data = undefined
    if (method !== 'GET' && bodyValue) {
      data = bodyValue
      // Attempt to set Content-Type if not present and body looks like JSON
      if (!headers['Content-Type'] && typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
        headers['Content-Type'] = 'application/json'
      }
    }
    // --- End Common Setup ---

    const { data: apiResponseData, status: apiResponseStatus, statusText: apiResponseStatusText } = await doHttpRequest({
      url: endpoint,
      method,
      headers,
      params: params as Record<string, unknown>,
      data,
      timeout
    }) 

    // --- Common Response Handling --- 
    worker.fields.error.value = '' // Clear previous error

    if (apiResponseStatus && apiResponseStatus >= 200 && apiResponseStatus < 300) {
      // Success (2xx)
      if (apiResponseData !== undefined && apiResponseData !== null) {
        const responseString = typeof apiResponseData === 'object'
          ? JSON.stringify(apiResponseData, null, 2)
          : String(apiResponseData)
        worker.fields.response.value = responseString
      } else {
        const successMsg = `Request successful: ${apiResponseStatus} ${apiResponseStatusText || ''}`
        worker.fields.response.value = successMsg
      }
    } else {
      // Non-Success (3xx, 4xx, or error from proxy)
      const errorStatus = apiResponseStatus || 'Unknown'
      const errorStatusText = apiResponseStatusText || 'Error'
      const errorMsg = `Request failed with status code ${errorStatus} (${errorStatusText})`
      let errorDataString = ''
      if (apiResponseData) {
        try {
          errorDataString = typeof apiResponseData === 'object' ? JSON.stringify(apiResponseData) : String(apiResponseData)
        } catch (e) { errorDataString = '[Could not stringify error data]' }
      }
      console.warn(`${logPrefix} - Non-Success Response Status: ${errorStatus}. Data: ${errorDataString}`)
      const fullErrorMsg = errorDataString ? `${errorMsg} (Response Data: ${errorDataString})` : errorMsg
      worker.fields.error.value = fullErrorMsg
      worker.fields.response.value = ''
    }
    // --- End Common Response Handling ---

  } catch (error) {
    // --- Common Error Handling (Network errors, 5xx, setup errors, proxy errors) ---
    console.error(`${logPrefix} - Caught error in main try block:`, error)
    worker.fields.response.value = ''
    let errorMessage = "An unknown error occurred."
    if (axios.isAxiosError(error)) {
      errorMessage = error.message
      if (error.response) {
        // Error with a response (e.g., 5xx from direct call, or maybe proxy itself failed)
        errorMessage = `Request failed with status code ${error.response.status} (${error.response.statusText || 'Error'})`
        console.error(`${logPrefix} - Axios error with response: Status=${error.response.status}, Data=`, error.response.data)
        if (error.response.data) {
          try { errorMessage += ` (Response Data: ${typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)})` }
          catch (e) { /* ignore stringify error */ }
        }
      } else if (error.request) {
        // No response received or setup failed
        errorMessage = `No response received or request setup failed: ${error.message}`
        console.error(`${logPrefix} - Axios error without response:`, error.request)
      } else {
        console.error(`${logPrefix} - Axios error during setup: ${error.message}`)
      }
    } else if (error instanceof Error) {
      errorMessage = error.message
      console.error(`${logPrefix} - Non-Axios error: ${error.message}`, error.stack)
    } else {
      try { errorMessage = JSON.stringify(error) } catch (e) { errorMessage = String(error) }
      console.error(`${logPrefix} - Unknown error type:`, error)
    }
    worker.fields.error.value = errorMessage
    // --- End Common Error Handling ---
  }
}

export const api: WorkerRegistryItem = {
  title: "API Call",
  type: "api",
  category: "io",
  description: "This worker allows you to make external API calls to use other external services.", // Updated description
  execute,
  create,
  get registry() { return api },
}