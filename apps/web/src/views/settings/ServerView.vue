<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { Server, LogOut } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'
import { useAuthStore } from '@/stores/auth'
import { getHealth } from '@/lib/api-client'

const auth = useAuthStore()
const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
const backendUrl = ref('')
const email = ref('')
const password = ref('')
const connected = ref(false)
const connecting = ref(false)
const isLogin = ref(true)
const { t } = useI18n()

async function loadConfig() {
  try {
    config.value = await getConfig()
    backendUrl.value = config.value.backendUrl ?? ''

    if (config.value.backendUrl) {
      try {
        const health = await getHealth()
        connected.value = health.status === 'ok'
      } catch {
        connected.value = false
      }
    } else {
      connected.value = false
    }
  } catch (e) {
    toast.error(t('common.loadConfigFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function connect() {
  if (!backendUrl.value) return
  connecting.value = true

  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  snapshot.backendUrl = backendUrl.value
  try {
    await saveConfig(snapshot)
    config.value = snapshot

    const health = await getHealth()
    if (health.status === 'ok') {
      connected.value = true
      toast.success(t('settings.server.connectSuccess'), {
        description: t('settings.server.backendVersion', {
          version: health.version ?? t('common.unknown'),
        }),
      })
    } else {
      throw new Error(t('settings.server.backendAbnormal'))
    }
  } catch (e) {
    connected.value = false
    const snapshot2 = JSON.parse(JSON.stringify(config.value)) as AppConfig
    snapshot2.backendUrl = ''
    await saveConfig(snapshot2).catch(() => {})
    config.value = snapshot2
    toast.error(t('settings.server.connectFailed'), {
      description: e instanceof Error ? e.message : t('settings.server.connectFailedHint'),
    })
  } finally {
    connecting.value = false
  }
}

async function disconnect() {
  auth.logout()
  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  snapshot.backendUrl = ''
  try {
    await saveConfig(snapshot)
    config.value = snapshot
    connected.value = false
    backendUrl.value = ''
  } catch (e) {
    toast.error(t('common.saveFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function handleAuth() {
  if (!email.value || !password.value) return

  const success = isLogin.value
    ? await auth.login(email.value, password.value)
    : await auth.register(email.value, password.value)

  if (success) {
    toast.success(
      isLogin.value ? t('settings.server.loginSuccess') : t('settings.server.registerSuccess'),
    )
  } else {
    toast.error(
      isLogin.value ? t('settings.server.loginFailed') : t('settings.server.registerFailed'),
      {
        description: auth.error ?? t('settings.server.checkCredentials'),
      },
    )
  }
}

async function handleLogout() {
  auth.logout()
  toast.success(t('settings.server.loggedOut'))
}

function toggleMode() {
  isLogin.value = !isLogin.value
  auth.error = null
}

loadConfig()
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Connection Status -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Server class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">{{ $t('settings.server.connectionStatus') }}</h3>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ $t('settings.server.connectionStatusDesc') }}
        </p>
      </div>

      <div
        class="flex items-center gap-3 px-4 py-3 rounded-lg border transition-colors duration-200"
        :class="
          connected
            ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
            : 'bg-muted/50 border-transparent'
        "
      >
        <Server
          class="size-5 shrink-0"
          :class="connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'"
        />
        <div
          class="size-2.5 rounded-full shrink-0 transition-colors duration-300"
          :class="connected ? 'bg-green-500 shadow-sm shadow-green-500/30' : 'bg-muted-foreground'"
        />
        <span class="text-sm font-medium">{{
          connected ? $t('settings.server.connected') : $t('settings.server.disconnected')
        }}</span>
        <span
          v-if="connected && auth.isAuthenticated"
          class="text-xs text-emerald-600 dark:text-emerald-400 ml-auto"
        >
          {{ auth.user?.email }}
        </span>
        <span
          v-else-if="connected"
          class="text-xs text-muted-foreground ml-auto truncate max-w-[280px]"
          :title="backendUrl"
        >
          {{ backendUrl }}
        </span>
      </div>
    </section>

    <!-- Auth or Connection Form -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Server class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">{{ $t('settings.server.title') }}</h3>
        </div>
      </div>

      <div class="space-y-3">
        <div class="space-y-1.5">
          <Label class="text-xs">{{ $t('settings.server.serverAddress') }}</Label>
          <Input
            v-model="backendUrl"
            placeholder="https://storyclaw.example.com"
            class="focus-visible:ring-0"
            :disabled="connected"
          />
        </div>

        <template v-if="connected && !auth.isAuthenticated">
          <div class="space-y-1.5">
            <Label class="text-xs">{{ $t('settings.server.email') }}</Label>
            <Input v-model="email" placeholder="your@email.com" class="focus-visible:ring-0" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">{{ $t('settings.server.password') }}</Label>
            <Input v-model="password" type="password" class="focus-visible:ring-0" />
          </div>
        </template>

        <template v-if="connected && auth.isAuthenticated">
          <div class="px-4 py-3 rounded-lg border bg-muted/30 space-y-2">
            <div class="flex items-center justify-between">
              <span class="text-sm font-medium">{{ auth.user?.email }}</span>
              <span
                v-if="auth.isAdmin"
                class="text-xs px-2 py-0.5 rounded-full bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400"
              >
                {{ $t('settings.server.admin') }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground">{{ $t('settings.server.loggedIn') }}</p>
          </div>
        </template>

        <!-- Backend proxy temporarily disabled (security concern) -->
        <!-- <div v-if="connected" class="flex items-center justify-between px-1 py-2">
          <div>
            <Label class="text-xs">{{ $t('settings.server.proxy.label') }}</Label>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              {{ $t('settings.server.proxy.description') }}
            </p>
          </div>
          <Switch :checked="proxyEnabled" @update:checked="toggleProxy" />
        </div> -->
      </div>

      <!-- Actions -->
      <div class="space-y-2 pt-1">
        <!-- Not connected -->
        <Button
          v-if="!connected"
          class="w-full"
          :disabled="!backendUrl || connecting"
          @click="connect"
        >
          {{ connecting ? $t('settings.server.connecting') : $t('settings.server.connect') }}
        </Button>

        <!-- Connected, not authenticated -->
        <template v-else-if="!auth.isAuthenticated">
          <Button
            class="w-full"
            :disabled="!email || !password || auth.isLoading"
            @click="handleAuth"
          >
            {{
              auth.isLoading
                ? $t('settings.server.pleaseWait')
                : isLogin
                  ? $t('settings.server.login')
                  : $t('settings.server.register')
            }}
          </Button>
          <Button variant="ghost" class="w-full text-xs" @click="toggleMode">
            {{ isLogin ? $t('settings.server.noAccount') : $t('settings.server.hasAccount') }}
          </Button>
          <Button variant="outline" class="w-full" @click="disconnect">
            {{ $t('settings.server.disconnect') }}
          </Button>
        </template>

        <!-- Connected and authenticated -->
        <template v-else>
          <Button variant="outline" class="w-full" @click="handleLogout">
            <LogOut class="size-3.5 mr-2" />
            {{ $t('settings.server.logout') }}
          </Button>
          <Button variant="ghost" class="w-full text-xs" @click="disconnect">
            {{ $t('settings.server.disconnect') }}
          </Button>
        </template>
      </div>

      <!-- Error Display -->
      <div
        v-if="auth.error"
        class="px-3 py-2 rounded-lg bg-red-50 dark:bg-red-950/20 border border-red-200 dark:border-red-800/60"
      >
        <p class="text-xs text-red-600 dark:text-red-400">{{ auth.error }}</p>
      </div>
    </section>

    <!-- Footer -->
    <div class="border-t pt-4">
      <p class="text-xs text-muted-foreground text-center">
        {{ $t('settings.server.localModeHint') }}
      </p>
    </div>
  </div>
</template>
