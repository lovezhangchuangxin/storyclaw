import { defineStore } from 'pinia'
import { ref, computed } from 'vue'
import {
  login as apiLogin,
  register as apiRegister,
  refreshAuthToken,
  clearTokens,
  loadTokensFromStorage,
  ApiError,
} from '@/lib/api-client'
import { getDeviceFingerprint } from '@/lib/fingerprint'
import { i18n } from '@/i18n'
import type { AuthResponse, UserInfo } from '@/db/types'

const USER_KEY = 'storyclaw_user'

function saveUser(user: UserInfo) {
  try {
    localStorage.setItem(USER_KEY, JSON.stringify(user))
  } catch {}
}

function loadUser(): UserInfo | null {
  try {
    const raw = localStorage.getItem(USER_KEY)
    return raw ? JSON.parse(raw) : null
  } catch {
    return null
  }
}

function clearUser() {
  try {
    localStorage.removeItem(USER_KEY)
  } catch {}
}

export const useAuthStore = defineStore('auth', () => {
  const user = ref<UserInfo | null>(null)
  const isLoading = ref(false)
  const error = ref<string | null>(null)

  const isAuthenticated = computed(() => user.value !== null)
  const isAdmin = computed(() => user.value?.role === 'admin')
  const userId = computed(() => user.value?.id ?? null)

  function initialize() {
    loadTokensFromStorage()
    const savedUser = loadUser()
    if (savedUser) {
      user.value = savedUser
    }
  }

  async function login(email: string, password: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const data: AuthResponse = await apiLogin(email, password)
      user.value = data.user
      saveUser(data.user)
      return true
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Login failed'
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function register(email: string, password: string): Promise<boolean> {
    isLoading.value = true
    error.value = null
    try {
      const fp = await getDeviceFingerprint()
      const data: AuthResponse = await apiRegister(email, password, fp)
      user.value = data.user
      saveUser(data.user)
      return true
    } catch (e) {
      if (e instanceof ApiError) {
        const errType = (e.data as { error?: string })?.error
        const errKeyMap: Record<string, string> = {
          too_many_registrations: 'tooManyRegistrations',
          suspicious_registration: 'suspiciousRegistration',
        }
        const i18nKey = errType ? errKeyMap[errType] : undefined
        if (i18nKey) {
          error.value = i18n.global.t(`settings.server.${i18nKey}`)
        } else {
          error.value = e.message
        }
      } else {
        error.value = e instanceof Error ? e.message : 'Registration failed'
      }
      return false
    } finally {
      isLoading.value = false
    }
  }

  async function refreshAuth(): Promise<boolean> {
    try {
      const data = await refreshAuthToken()
      user.value = data.user
      saveUser(data.user)
      return true
    } catch {
      logout()
      return false
    }
  }

  function logout() {
    user.value = null
    error.value = null
    clearTokens()
    clearUser()
  }

  initialize()

  return {
    user,
    isLoading,
    error,
    isAuthenticated,
    isAdmin,
    userId,
    login,
    register,
    refreshAuth,
    logout,
    initialize,
  }
})
