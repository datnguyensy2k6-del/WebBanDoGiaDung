const API_BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:5000/api').replace(/\/+$/, '')
const SUPPORTED_METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE'])
const AUTH_TOKEN_STORAGE_KEY = 'homenest.authToken'

function readStoredAuthToken() {
  try {
    return typeof window === 'undefined' ? null : window.sessionStorage.getItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    return null
  }
}

let authToken = readStoredAuthToken()

export class ApiError extends Error {
  constructor(message, { status = null, code = 'API_ERROR', payload = null, cause } = {}) {
    super(message, { cause })
    this.name = 'ApiError'
    this.status = status
    this.code = code
    this.payload = payload
  }
}

export function setAuthToken(token) {
  if (token !== null && token !== undefined && typeof token !== 'string') {
    throw new TypeError('Auth token must be a string or null.')
  }
  authToken = token || null
  try {
    if (typeof window !== 'undefined') {
      if (authToken) window.sessionStorage.setItem(AUTH_TOKEN_STORAGE_KEY, authToken)
      else window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
    }
  } catch {
    // Keep the in-memory session working when browser storage is unavailable.
  }
}

export function clearAuthToken() {
  authToken = null
  try {
    if (typeof window !== 'undefined') window.sessionStorage.removeItem(AUTH_TOKEN_STORAGE_KEY)
  } catch {
    // The in-memory token is still cleared when browser storage is unavailable.
  }
}

export function getAuthToken() {
  if (!authToken) authToken = readStoredAuthToken()
  return authToken
}

export async function apiRequest(path, options = {}) {
  const method = (options.method || 'GET').toUpperCase()
  if (!SUPPORTED_METHODS.has(method)) {
    throw new TypeError(`Unsupported API method: ${method}`)
  }
  if (typeof path !== 'string' || !path.trim()) {
    throw new TypeError('API path must be a non-empty string.')
  }

  const { body, headers: customHeaders, token, ...fetchOptions } = options
  const headers = new Headers(customHeaders)
  headers.set('Accept', 'application/json')

  const requestToken = token === undefined ? getAuthToken() : token
  if (requestToken) headers.set('Authorization', `Bearer ${requestToken}`)

  let requestBody = body
  if (body !== undefined && body !== null) {
    const isJsonBody = typeof body === 'object'
      && (Object.getPrototypeOf(body) === Object.prototype || Array.isArray(body))
    if (isJsonBody) {
      requestBody = JSON.stringify(body)
      if (!headers.has('Content-Type')) headers.set('Content-Type', 'application/json')
    }
  }

  const normalizedPath = path.replace(/^\/+/, '')
  const url = `${API_BASE_URL}/${normalizedPath}`

  let response
  try {
    response = await fetch(url, {
      ...fetchOptions,
      method,
      headers,
      ...(requestBody === undefined ? {} : { body: requestBody }),
    })
  } catch (error) {
    if (error?.name === 'AbortError') throw error
    throw new ApiError('Không thể kết nối Backend. Hãy kiểm tra Backend và thử lại.', {
      code: 'NETWORK_ERROR',
      cause: error,
    })
  }

  const contentType = response.headers.get('content-type') || ''
  const responseText = response.status === 204 ? '' : await response.text()
  let payload = null

  if (responseText) {
    if (contentType.includes('application/json')) {
      try {
        payload = JSON.parse(responseText)
      } catch (error) {
        if (response.ok) {
          throw new ApiError('Backend trả về JSON không hợp lệ.', {
            status: response.status,
            code: 'INVALID_JSON_RESPONSE',
            cause: error,
          })
        }
        payload = responseText
      }
    } else {
      payload = responseText
    }
  }

  if (!response.ok) {
    const message = typeof payload?.message === 'string'
      ? payload.message
      : `Yêu cầu API thất bại (HTTP ${response.status}).`
    throw new ApiError(message, {
      status: response.status,
      code: payload?.code || `HTTP_${response.status}`,
      payload,
    })
  }

  return payload
}

export const api = {
  request: apiRequest,
  get: (path, options) => apiRequest(path, { ...options, method: 'GET' }),
  post: (path, body, options) => apiRequest(path, { ...options, method: 'POST', body }),
  put: (path, body, options) => apiRequest(path, { ...options, method: 'PUT', body }),
  patch: (path, body, options) => apiRequest(path, { ...options, method: 'PATCH', body }),
  delete: (path, options) => apiRequest(path, { ...options, method: 'DELETE' }),
}

export default api
