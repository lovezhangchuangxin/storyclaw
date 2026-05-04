import { getConfig } from '@/db/config'
import type {
  AuthResponse,
  HealthResponse,
  LoginRequest,
  RegisterRequest,
  RefreshRequest,
  AdminStats,
  AdminUserSummary,
  AdminNovelSummary,
  PaginatedResponse,
  PushNovelRequest,
  PushNovelResponse,
  PullNovelResponse,
} from '@/db/types'

const ACCESS_TOKEN_KEY = 'storyclaw_access_token'
const REFRESH_TOKEN_KEY = 'storyclaw_refresh_token'

export class ApiError extends Error {
  status: number
  data: unknown

  constructor(message: string, status: number, data?: unknown) {
    super(message)
    this.name = 'ApiError'
    this.status = status
    this.data = data
  }
}

interface TokenStore {
  accessToken: string | null
  refreshToken: string | null
}

const tokens: TokenStore = {
  accessToken: null,
  refreshToken: null,
}

export function setTokens(access: string, refresh: string) {
  tokens.accessToken = access
  tokens.refreshToken = refresh
  localStorage.setItem(ACCESS_TOKEN_KEY, access)
  localStorage.setItem(REFRESH_TOKEN_KEY, refresh)
}

export function getAccessToken(): string | null {
  return tokens.accessToken
}

export function clearTokens() {
  tokens.accessToken = null
  tokens.refreshToken = null
  localStorage.removeItem(ACCESS_TOKEN_KEY)
  localStorage.removeItem(REFRESH_TOKEN_KEY)
}

export function loadTokensFromStorage() {
  const access = localStorage.getItem(ACCESS_TOKEN_KEY)
  const refresh = localStorage.getItem(REFRESH_TOKEN_KEY)
  if (access) tokens.accessToken = access
  if (refresh) tokens.refreshToken = refresh
}

let refreshPromise: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  if (!tokens.refreshToken) return false
  try {
    const config = await getConfig()
    if (!config.backendUrl) return false

    const resp = await fetch(`${config.backendUrl}/api/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: tokens.refreshToken } as RefreshRequest),
    })

    if (!resp.ok) {
      clearTokens()
      return false
    }

    const data: AuthResponse = await resp.json()
    setTokens(data.access_token, data.refresh_token)
    return true
  } catch {
    return false
  }
}

async function refreshTokensIfNeeded(): Promise<boolean> {
  if (refreshPromise) {
    return refreshPromise
  }

  refreshPromise = doRefresh().finally(() => {
    refreshPromise = null
  })

  return refreshPromise
}

async function fetchApi<T>(
  path: string,
  options: RequestInit = {},
  requireAuth = true,
): Promise<T> {
  const config = await getConfig()
  if (!config.backendUrl) {
    throw new ApiError('Backend URL not configured', 0)
  }

  const url = `${config.backendUrl}${path}`
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.headers as Record<string, string>),
  }

  if (requireAuth && tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`
  }

  let resp = await fetch(url, { ...options, headers })

  if (resp.status === 401 && requireAuth && tokens.refreshToken) {
    const refreshed = await refreshTokensIfNeeded()
    if (refreshed && tokens.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`
      resp = await fetch(url, { ...options, headers })
    }
  }

  if (!resp.ok) {
    let errorData: unknown
    try {
      errorData = await resp.json()
    } catch {
      errorData = await resp.text()
    }

    const message =
      typeof errorData === 'object' && errorData !== null && 'message' in errorData
        ? String((errorData as { message: string }).message)
        : `Request failed with status ${resp.status}`

    throw new ApiError(message, resp.status, errorData)
  }

  if (resp.status === 204) {
    return undefined as T
  }

  return resp.json()
}

export async function getHealth(): Promise<HealthResponse> {
  return fetchApi<HealthResponse>('/api/health', {}, false)
}

export async function register(email: string, password: string): Promise<AuthResponse> {
  const data = await fetchApi<AuthResponse>(
    '/api/auth/register',
    {
      method: 'POST',
      body: JSON.stringify({ email, password } as RegisterRequest),
    },
    false,
  )
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function login(email: string, password: string): Promise<AuthResponse> {
  const data = await fetchApi<AuthResponse>(
    '/api/auth/login',
    {
      method: 'POST',
      body: JSON.stringify({ email, password } as LoginRequest),
    },
    false,
  )
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function refreshAuthToken(): Promise<AuthResponse> {
  if (!tokens.refreshToken) {
    throw new ApiError('No refresh token available', 401)
  }
  const data = await fetchApi<AuthResponse>(
    '/api/auth/refresh',
    {
      method: 'POST',
      body: JSON.stringify({ refresh_token: tokens.refreshToken } as RefreshRequest),
    },
    false,
  )
  setTokens(data.access_token, data.refresh_token)
  return data
}

export async function listNovels(page = 1, perPage = 20): Promise<PaginatedResponse<Record<string, unknown>>> {
  return fetchApi<PaginatedResponse<Record<string, unknown>>>(`/api/novels?page=${page}&per_page=${perPage}`)
}

export async function pushNovel(
  id: string,
  data: PushNovelRequest['data'],
  version: number,
): Promise<PushNovelResponse> {
  return fetchApi<PushNovelResponse>(`/api/novels/${encodeURIComponent(id)}/push`, {
    method: 'POST',
    body: JSON.stringify({ data, version } as PushNovelRequest),
  })
}

export async function pullNovel(id: string): Promise<PullNovelResponse> {
  return fetchApi<PullNovelResponse>(`/api/novels/${encodeURIComponent(id)}/pull`)
}

export async function deleteNovel(id: string): Promise<void> {
  return fetchApi<void>(`/api/novels/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export async function llmChat(requestBody: unknown): Promise<Response> {
  const config = await getConfig()
  if (!config.backendUrl) {
    throw new ApiError('Backend URL not configured', 0)
  }

  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  }
  if (tokens.accessToken) {
    headers['Authorization'] = `Bearer ${tokens.accessToken}`
  }

  let resp = await fetch(`${config.backendUrl}/api/llm/chat`, {
    method: 'POST',
    headers,
    body: JSON.stringify(requestBody),
  })

  if (resp.status === 401 && tokens.refreshToken) {
    const refreshed = await refreshTokensIfNeeded()
    if (refreshed && tokens.accessToken) {
      headers['Authorization'] = `Bearer ${tokens.accessToken}`
      resp = await fetch(`${config.backendUrl}/api/llm/chat`, {
        method: 'POST',
        headers,
        body: JSON.stringify(requestBody),
      })
    }
  }

  if (!resp.ok) {
    let errorData: unknown
    try { errorData = await resp.json() } catch { errorData = await resp.text() }
    throw new ApiError(`LLM proxy error: ${resp.status}`, resp.status, errorData)
  }

  return resp
}

export async function adminListUsers(
  page = 1,
  perPage = 20,
): Promise<PaginatedResponse<AdminUserSummary>> {
  return fetchApi<PaginatedResponse<AdminUserSummary>>(
    `/api/admin/users?page=${page}&per_page=${perPage}`,
  )
}

export async function adminGetUser(id: string): Promise<AdminUserSummary> {
  return fetchApi<AdminUserSummary>(`/api/admin/users/${encodeURIComponent(id)}`)
}

export async function adminListNovels(
  page = 1,
  perPage = 20,
): Promise<PaginatedResponse<AdminNovelSummary>> {
  return fetchApi<PaginatedResponse<AdminNovelSummary>>(
    `/api/admin/novels?page=${page}&per_page=${perPage}`,
  )
}

export async function adminGetStats(): Promise<AdminStats> {
  return fetchApi<AdminStats>('/api/admin/stats')
}

loadTokensFromStorage()
