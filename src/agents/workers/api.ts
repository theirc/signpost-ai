import axios from 'axios'

export interface ApiWorker extends AIWorker {
  fields: {
    body: NodeIO
    response: NodeIO
    error: NodeIO
    condition: NodeIO // Ensure condition field exists if using ConditionHandler
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
      { type: "unknown", direction: "input", title: "Condition", name: "condition", condition: true },
      { type: "string", direction: "input", title: "Endpoint URL", name: "endpointUrlInput" },
    ],
    api
  )
  return worker
}

async function execute(worker: ApiWorker, p: AgentParameters) {
  const logPrefix = `[API Worker (${worker.id})]`
  console.log(`${logPrefix} - Executing with parameters:`, worker.parameters)
  console.log(`${logPrefix} - Input body value:`, worker.fields.body.value)
  console.log(`${logPrefix} - Provided AgentParameters.apikeys:`, p.apikeys ? Object.keys(p.apikeys) : 'None')

  try {
    // --- Common Setup --- 
    const runtimeEndpoint = worker.fields.endpointUrlInput?.value as string | undefined
    const fallbackEndpoint = worker.parameters.endpoint || ''
    const endpoint = runtimeEndpoint && runtimeEndpoint.trim() !== '' ? runtimeEndpoint.trim() : fallbackEndpoint
    console.log(`${logPrefix} - Determined Endpoint: ${endpoint} (Runtime: ${runtimeEndpoint}, Fallback: ${fallbackEndpoint})`)

    if (!endpoint) {
      console.error(`${logPrefix} - Endpoint is missing!`)
      throw new Error("API endpoint is required. Provide it either via the 'Endpoint URL' input handle or in the node parameters.")
    }

    const method = (worker.parameters.method || 'GET').toUpperCase()
    const paramsString = worker.parameters.params || '{}'
    const headersString = worker.parameters.headers || '{}'
    const timeout = worker.parameters.timeout || 10000
    const authType = worker.parameters.authType || 'none'
    const username = worker.parameters.username
    const selectedKeyName = worker.parameters.selectedKeyName || ''
    const bodyValue = worker.fields.body.value
    console.log(`${logPrefix} - Method: ${method}, Timeout: ${timeout}, AuthType: ${authType}, SelectedKey: ${selectedKeyName || 'None'}`)

    let params = {}
    try {
      params = JSON.parse(paramsString)
      console.log(`${logPrefix} - Parsed Params:`, params)
    } catch (e) {
      console.error(`${logPrefix} - Failed to parse Params JSON: ${paramsString}`, e)
      throw new Error("Invalid params JSON in parameters.")
    }
    let headers: Record<string, string> = {}
    try {
      headers = JSON.parse(headersString)
      console.log(`${logPrefix} - Parsed Headers (initial):`, headers)
    } catch (e) {
      console.error(`${logPrefix} - Failed to parse Headers JSON: ${headersString}`, e)
      throw new Error("Invalid headers JSON in parameters.")
    }

    // Clean sensitive headers before logging/using
    delete headers['Authorization']
    delete headers['X-API-Key']
    Object.keys(headers).forEach(key => {
      if (key.toLowerCase() === 'x-api-key' || key.toLowerCase() === 'authorization') delete headers[key]
    })
    console.log(`${logPrefix} - Headers after cleaning sensitive ones:`, headers)

    let actualValue: string | undefined
    if (authType !== 'none' && authType) {
      console.log(`${logPrefix} - Auth required (${authType}). Selected Key Name: ${selectedKeyName}`)
      if (!selectedKeyName) {
        console.error(`${logPrefix} - Auth type specified but no key name selected.`)
        throw new Error(`Auth type '${authType}' selected, but no Stored Key Name chosen.`)
      }

      // 1. Check Environment Variables first
      const envVarValue = process.env[selectedKeyName]
      if (envVarValue !== undefined && envVarValue !== '') {
        actualValue = envVarValue
        // DO NOT log the actual key value here for security
        console.log(`${logPrefix} - Found key '${selectedKeyName}' in environment variable.`)
      } else {
        console.log(`${logPrefix} - Key '${selectedKeyName}' not found or empty in environment variables. Checking AgentParameters...`)
        // 2. If not in env, check AgentParameters.apikeys
        const paramKeyValue = p.apikeys?.[selectedKeyName]
        if (paramKeyValue !== undefined) {
          actualValue = paramKeyValue
          // DO NOT log the actual key value here for security
          console.log(`${logPrefix} - Found key '${selectedKeyName}' in AgentParameters.apikeys.`)
        } else {
          // 3. If not found in either, throw error
          console.error(`${logPrefix} - Key '${selectedKeyName}' not found in environment or AgentParameters.`)
          throw new Error(`Selected stored key "${selectedKeyName}" not found in environment variables or provided AgentParameters.apikeys.`)
        }
      }
    }

    switch (authType) {
      case 'basic':
        console.log(`${logPrefix} - Applying Basic Auth.`)
        if (!username) {
          console.error(`${logPrefix} - Basic Auth selected but username is missing.`)
          throw new Error("Username required for Basic Auth.")
        }
        if (actualValue !== undefined) {
          headers.Authorization = `Basic ${btoa(`${username}:${actualValue}`)}`
          console.log(`${logPrefix} - Added Basic Auth header.`)
        } else {
          console.warn(`${logPrefix} - Basic Auth selected but key value was not found.`)
        }
        break
      case 'bearer':
        console.log(`${logPrefix} - Applying Bearer Auth.`)
        if (actualValue !== undefined) {
          headers.Authorization = `Bearer ${actualValue}`
          console.log(`${logPrefix} - Added Bearer Auth header.`)
        } else {
          console.warn(`${logPrefix} - Bearer Auth selected but key value was not found.`)
        }
        break
      case 'api_key':
        console.log(`${logPrefix} - Applying API Key Auth (X-API-Key header).`)
        if (actualValue !== undefined) {
          headers['X-API-Key'] = actualValue
          console.log(`${logPrefix} - Added X-API-Key header.`)
        } else {
          console.warn(`${logPrefix} - API Key Auth selected but key value was not found.`)
        }
        break
      default:
        console.log(`${logPrefix} - No Auth or unknown auth type: ${authType}.`)
    }

    let data = undefined
    if (method !== 'GET' && bodyValue) {
      data = bodyValue
      console.log(`${logPrefix} - Method is ${method}, using body value.`)
      // Attempt to set Content-Type if not present and body looks like JSON
      if (!headers['Content-Type'] && typeof data === 'string' && (data.trim().startsWith('{') || data.trim().startsWith('['))) {
        headers['Content-Type'] = 'application/json'
        console.log(`${logPrefix} - Auto-detected JSON body, setting Content-Type to application/json.`)
      }
    }
    // --- End Common Setup ---
    console.log(`${logPrefix} - Final Headers before request:`, headers)
    console.log(`${logPrefix} - Final Params before request:`, params)
    console.log(`${logPrefix} - Final Data before request:`, data ? (typeof data === 'string' ? data.substring(0, 100) + '...' : '[Non-string data]') : 'None')

    // --- Environment Check and Call --- 
    const isBrowser = typeof window !== 'undefined'
    let apiResponseData: any
    let apiResponseStatus: number | undefined
    let apiResponseStatusText: string | undefined

    if (isBrowser) {
      // FRONTEND: Use the proxy
      console.log(`${logPrefix} [Browser] - Using proxy /api/axiosFetch for: ${endpoint}`)
      const proxyPayload = { url: endpoint, method, headers, params, data, timeout }
      console.log(`${logPrefix} [Browser] - Proxy payload:`, proxyPayload)
      const proxyResponse = await axios({
        method: 'POST',
        url: '/api/axiosFetch',
        data: proxyPayload
      })
      console.log(`${logPrefix} [Browser] - Proxy response status: ${proxyResponse.status}`)

      if (proxyResponse.status !== 200) {
        console.error(`${logPrefix} [Browser] - Proxy service request failed! Status: ${proxyResponse.status}`)
        throw new Error(`Proxy service request failed: ${proxyResponse.status} ${proxyResponse.statusText}`)
      }
      // Assuming proxy returns { status, statusText, data, error? }
      const proxyResult = proxyResponse.data
      console.log(`${logPrefix} [Browser] - Proxy result:`, proxyResult)
      if (proxyResult?.error) {
        console.error(`${logPrefix} [Browser] - Error received from proxy: ${proxyResult.error}`)
        throw new Error(`Proxy error: ${proxyResult.error} ${proxyResult.message || ''}`)
      }
      apiResponseData = proxyResult?.data
      apiResponseStatus = proxyResult?.status
      apiResponseStatusText = proxyResult?.statusText

    } else {
      // BACKEND: Make direct call
      console.log(`${logPrefix} [Node.js] - Making direct ${method} request to: ${endpoint}`)
      const axiosConfig = {
        method: method as any,
        url: endpoint,
        headers: headers,
        params: params,
        data: data,
        timeout: timeout,
        validateStatus: (status) => status >= 200 && status < 500, // Handle 4xx locally
      }
      console.log(`${logPrefix} [Node.js] - Axios config:`, {
        ...axiosConfig,
        headers: { ...axiosConfig.headers, Authorization: '[REDACTED]', 'X-API-Key': '[REDACTED]' } // Redact sensitive headers for logging
      })
      const directResponse = await axios(axiosConfig)
      console.log(`${logPrefix} [Node.js] - Direct response status: ${directResponse.status} ${directResponse.statusText}`)
      apiResponseData = directResponse.data
      apiResponseStatus = directResponse.status
      apiResponseStatusText = directResponse.statusText
    }
    // --- End Environment Check and Call --- 

    // --- Common Response Handling --- 
    console.log(`${logPrefix} - Handling response. Status: ${apiResponseStatus}, StatusText: ${apiResponseStatusText}`)
    worker.fields.error.value = '' // Clear previous error

    if (apiResponseStatus && apiResponseStatus >= 200 && apiResponseStatus < 300) {
      // Success (2xx)
      console.log(`${logPrefix} - Success Response Status: ${apiResponseStatus}`)
      if (apiResponseData !== undefined && apiResponseData !== null) {
        const responseString = typeof apiResponseData === 'object'
          ? JSON.stringify(apiResponseData, null, 2)
          : String(apiResponseData)
        worker.fields.response.value = responseString
        console.log(`${logPrefix} - Setting response field (first 200 chars):`, responseString.substring(0, 200) + '...')
      } else {
        const successMsg = `Request successful: ${apiResponseStatus} ${apiResponseStatusText || ''}`
        worker.fields.response.value = successMsg
        console.log(`${logPrefix} - Setting response field: ${successMsg}`)
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
      console.log(`${logPrefix} - Setting error field: ${fullErrorMsg}`)
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
    console.log(`${logPrefix} - Setting error field from catch block: ${errorMessage}`)
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