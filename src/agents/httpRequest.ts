import axios from 'axios'

function base64Encode(str: string): string {
  if (typeof Buffer !== 'undefined') {
    return Buffer.from(str, 'utf8').toString('base64')
  }
  if (typeof btoa !== 'undefined') {
    return btoa(str)
  }
  throw new Error('No base64 encode available (missing Buffer and btoa)')
}

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
  let actualValue: string | undefined
  if (typeof process !== 'undefined' && process.env) {
    actualValue = process.env[selectedKeyName]
  } else {
    actualValue = undefined
  }
  if (actualValue === undefined) actualValue = apiKeys?.[selectedKeyName]
  if (actualValue === undefined) return undefined
  if (authType === 'basic' && username) {
    headers.Authorization = `Basic ${base64Encode(`${username}:${actualValue}`)}`
  } else if (authType === 'bearer') {
    headers.Authorization = `Bearer ${actualValue}`
  } else if (authType === 'api_key') {
    headers['X-API-Key'] = actualValue
  }
  return actualValue
}

/** In-memory cache for OAuth2 client credentials tokens: key -> { token, expiresAtMs } */
const oauth2TokenCache = new Map<string, { token: string; expiresAtMs: number }>()
/** Refresh token this many ms before expiry so we never send an expired token (default: 1 min) */
const OAUTH2_EARLY_REFRESH_MS = 60 * 1000

/**
 * Get an OAuth 2.0 Client Credentials access token.
 * Used by External API Connector and Databricks SQL Connector for APIs that use this pattern (e.g. Databricks, Azure AD, Okta).
 */
export async function getOAuth2ClientCredentialsToken(
  tokenUrl: string,
  clientId: string,
  clientSecret: string,
  scope: string | undefined,
  timeout: number
): Promise<string> {
  const cacheKey = `${tokenUrl}:${clientId}`
  const cached = oauth2TokenCache.get(cacheKey)
  if (cached && Date.now() < cached.expiresAtMs - OAUTH2_EARLY_REFRESH_MS) {
    return cached.token
  }

  const scopeToSend = (scope && scope.trim()) || (tokenUrl.includes('databricks') ? 'all-apis' : undefined)
  const body = scopeToSend
    ? `grant_type=client_credentials&scope=${encodeURIComponent(scopeToSend)}`
    : 'grant_type=client_credentials'
  const { data, status, statusText } = await doHttpRequest({
    url: tokenUrl,
    method: 'POST',
    headers: {
      Authorization: `Basic ${base64Encode(`${clientId}:${clientSecret}`)}`,
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    params: {},
    data: body,
    timeout
  })

  if (status < 200 || status >= 300) {
    const errMsg = typeof data === 'object' ? JSON.stringify(data) : String(data)
    throw new Error(`OAuth2 token failed ${status} ${statusText}: ${errMsg}`)
  }

  const token = (data as { access_token?: string })?.access_token
  if (!token) throw new Error('OAuth2 response missing access_token')

  const expiresIn = (data as { expires_in?: number })?.expires_in ?? 3600
  oauth2TokenCache.set(cacheKey, {
    token,
    expiresAtMs: Date.now() + expiresIn * 1000
  })
  return token
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
  const contentType = headers['Content-Type'] ?? headers['content-type'] ?? ''
  const isFormUrlEncoded = String(contentType).toLowerCase().includes('application/x-www-form-urlencoded')
  const isOidcToken = typeof url === 'string' && url.includes('/oidc/v1/token')
  const sendRawFormString = typeof data === 'string' && (isFormUrlEncoded || (method === 'POST' && isOidcToken))

  const axiosConfig = {
    method: method as 'GET' | 'POST' | 'PUT' | 'DELETE' | 'PATCH',
    url,
    headers: sendRawFormString ? { ...headers, 'Content-Type': 'application/x-www-form-urlencoded' } : headers,
    params,
    data,
    timeout,
    validateStatus: (s: number) => s >= 200 && s < 500,
    ...(sendRawFormString ? { transformRequest: [(d: unknown) => d] } : {})
  }
  const res = await axios(axiosConfig)
  return { data: res.data, status: res.status, statusText: res.statusText }
}
