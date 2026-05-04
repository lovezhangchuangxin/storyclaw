<script setup lang="ts">
import { ref } from 'vue'
import { Server, LogOut } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
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
const proxyEnabled = ref(false)
const isLogin = ref(true)

async function loadConfig() {
  try {
    config.value = await getConfig()
    backendUrl.value = config.value.backendUrl ?? ''
    proxyEnabled.value = config.value.useBackendProxy ?? false

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
    toast.error('加载配置失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function toggleProxy(enabled: boolean) {
  proxyEnabled.value = enabled
  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  snapshot.useBackendProxy = enabled
  try {
    await saveConfig(snapshot)
    config.value = snapshot
  } catch (e) {
    toast.error('保存设置失败')
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
      toast.success('连接成功', {
        description: `后端版本: ${health.version ?? '未知'}`,
      })
    } else {
      throw new Error('后端响应异常')
    }
  } catch (e) {
    connected.value = false
    const snapshot2 = JSON.parse(JSON.stringify(config.value)) as AppConfig
    snapshot2.backendUrl = ''
    await saveConfig(snapshot2).catch(() => {})
    config.value = snapshot2
    toast.error('连接失败', {
      description: e instanceof Error ? e.message : '无法连接到后端，请检查地址是否正确',
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
    toast.error('保存失败', {
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
    toast.success(isLogin.value ? '登录成功' : '注册成功')
  } else {
    toast.error(isLogin.value ? '登录失败' : '注册失败', {
      description: auth.error ?? '请检查邮箱和密码',
    })
  }
}

async function handleLogout() {
  auth.logout()
  toast.success('已退出登录')
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
          <h3 class="text-sm font-medium">连接状态</h3>
        </div>
        <p class="text-xs text-muted-foreground">后端服务的当前连接情况</p>
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
        <span class="text-sm font-medium">{{ connected ? '已连接' : '未连接' }}</span>
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
          <h3 class="text-sm font-medium">后端连接</h3>
        </div>
        <p class="text-xs text-muted-foreground">连接后端以跨设备同步数据和使用后端代理调用 LLM</p>
      </div>

      <div class="space-y-3">
        <div class="space-y-1.5">
          <Label class="text-xs">服务器地址</Label>
          <Input
            v-model="backendUrl"
            placeholder="https://storyclaw.example.com"
            class="focus-visible:ring-0"
            :disabled="connected"
          />
        </div>

        <template v-if="connected && !auth.isAuthenticated">
          <div class="space-y-1.5">
            <Label class="text-xs">邮箱</Label>
            <Input v-model="email" placeholder="your@email.com" class="focus-visible:ring-0" />
          </div>
          <div class="space-y-1.5">
            <Label class="text-xs">密码</Label>
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
                管理员
              </span>
            </div>
            <p class="text-xs text-muted-foreground">已登录，可使用同步和管理功能</p>
          </div>
        </template>

        <div v-if="connected" class="flex items-center justify-between px-1 py-2">
          <div>
            <Label class="text-xs">使用后端代理调用 LLM</Label>
            <p class="text-[11px] text-muted-foreground mt-0.5">
              开启后通过后端转发模型请求，无需在本地配置 API Key
            </p>
          </div>
          <Switch :checked="proxyEnabled" @update:checked="toggleProxy" />
        </div>
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
          {{ connecting ? '连接中...' : '连接' }}
        </Button>

        <!-- Connected, not authenticated -->
        <template v-else-if="!auth.isAuthenticated">
          <Button
            class="w-full"
            :disabled="!email || !password || auth.isLoading"
            @click="handleAuth"
          >
            {{ auth.isLoading ? '请稍候...' : isLogin ? '登录' : '注册' }}
          </Button>
          <Button variant="ghost" class="w-full text-xs" @click="toggleMode">
            {{ isLogin ? '没有账号？点击注册' : '已有账号？点击登录' }}
          </Button>
          <Button variant="outline" class="w-full" @click="disconnect"> 断开连接 </Button>
        </template>

        <!-- Connected and authenticated -->
        <template v-else>
          <Button variant="outline" class="w-full" @click="handleLogout">
            <LogOut class="size-3.5 mr-2" />
            退出登录
          </Button>
          <Button variant="ghost" class="w-full text-xs" @click="disconnect"> 断开连接 </Button>
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
        也可以不连接后端，直接使用本地模式。所有数据存储在浏览器中。
      </p>
    </div>
  </div>
</template>
