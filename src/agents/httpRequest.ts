import axios from 'axios'

export function parseJsonParams(paramsString: string): Record<string, unknown> {
  try {
    const parsed = JSON.parse(paramsString || '{}')
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

export function parseJsonHeaders(headersString: string): Record<string, string> {
  try {
    const parsed = JSON.parse(headersString || '{}')
    const headers = typeof parsed === 'object' && parsed !== null ? parsed : {}
    delete headers['Authorization']
    delete headers['X-API-Key']
    Object.keys(headers).forEach(k => {
      if (['authorization', 'x-api-key'].includes(k.toLowerCase())) delete headers[k]
    })
    return headers
  } catch {
    return {}
  }
}

export function applyAuth(
  authType: string,
  username: string | undefined,
  selectedKeyName: string,
  apiKeys: Record<string, string | undefined> | undefined,
  headers: Record<string, string>
): string | undefined {
  if (authType === 'none' || !selectedKeyName) return undefined
  let actualValue: string | undefined = process.env[selectedKeyName]
  if (actualValue === undefined) actualValue = apiKeys?.[selectedKeyName]
  if (actualValue === undefined) return undefined
  if (authType === 'basic' && username) {
    headers.Authorization = `Basic ${btoa(`${username}:${actualValue}`)}`
  } else if (authType === 'bearer') {
    headers.Authorization = `Bearer ${actualValue}`
  } else if (authType === 'api_key') {
    headers['X-API-Key'] = actualValue
  }
  return actualValue
}

export interface HttpRequestOptions {
  url: string
  method: string
  headers: Record<string, string>
  params: Record<string, unknown>
  data?: unknown
  timeout: number
}

export interface HttpRequestResult {
  data: unknown
  status: number
  statusText: string
}

export async function doHttpRequest(
  options: HttpRequestOptions
): Promise<HttpRequestResult> {
  const { url, method, headers, params, data, timeout } = options
  const isBrowser = typeof window !== 'undefined'
  if (isBrowser) {
    const proxyPayload = { url, method, headers, params, data, timeout }
    const proxyResponse = await fetch('/api/axiosFetch', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(proxyPayload)
    })
    if (!proxyResponse.ok) {
      const errorText = await proxyResponse.text()
      throw new Error(`Proxy failed: ${proxyResponse.status} - ${errorText}`)
    }
    const proxyResult = await proxyResponse.json()
    if (proxyResult?.error) throw new Error(`Proxy error: ${proxyResult.error} ${proxyResult.message || ''}`)
    return {
      data: proxyResult?.data,
      status: proxyResult?.status ?? 200,
      statusText: proxyResult?.statusText ?? 'OK'
    }
  }
  const axiosConfig = {
    method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url,
    headers,
    params,
    data,
    timeout,
    validateStatus: (s: number) => s >= 200 && s < 500
  }
  const res = await axios(axiosConfig)
  return { data: res.data, status: res.status, statusText: res.statusText }
}
