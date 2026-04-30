<script setup lang="ts">
import { ref } from 'vue'
import { Server } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'

const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
const backendUrl = ref('')
const email = ref('')
const password = ref('')
const connected = ref(false)

async function loadConfig() {
  try {
    config.value = await getConfig()
    backendUrl.value = config.value.backendUrl ?? ''
    connected.value = !!config.value.backendUrl
  } catch (e) {
    toast.error('加载配置失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function connect() {
  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  snapshot.backendUrl = backendUrl.value
  try {
    await saveConfig(snapshot)
    config.value = snapshot
    connected.value = true
  } catch (e) {
    toast.error('保存失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function disconnect() {
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

loadConfig()
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

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
        :class="connected
          ? 'bg-emerald-50 dark:bg-emerald-950/20 border-emerald-200 dark:border-emerald-800/60'
          : 'bg-muted/50 border-transparent'"
      >
        <Server class="size-5 shrink-0" :class="connected ? 'text-emerald-600 dark:text-emerald-400' : 'text-muted-foreground'" />
        <div
          class="size-2.5 rounded-full shrink-0 transition-colors duration-300"
          :class="connected ? 'bg-green-500 shadow-sm shadow-green-500/30' : 'bg-muted-foreground'"
        />
        <span class="text-sm font-medium">{{ connected ? '已连接' : '未连接' }}</span>
        <span
          v-if="connected"
          class="text-xs text-muted-foreground ml-auto truncate max-w-[280px]"
          :title="backendUrl"
        >
          {{ backendUrl }}
        </span>
      </div>
    </section>

    <!-- Connection Form -->
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
          />
        </div>

        <div v-if="connected" class="space-y-1.5">
          <Label class="text-xs">邮箱</Label>
          <Input
            v-model="email"
            placeholder="your@email.com"
            class="focus-visible:ring-0"
          />
        </div>
        <div v-if="connected" class="space-y-1.5">
          <Label class="text-xs">密码</Label>
          <Input
            v-model="password"
            type="password"
            class="focus-visible:ring-0"
          />
        </div>
      </div>

      <!-- Actions -->
      <div class="space-y-2 pt-1">
        <Button
          v-if="!connected"
          class="w-full"
          :disabled="!backendUrl"
          @click="connect"
        >
          连接
        </Button>
        <template v-else>
          <Button
            class="w-full"
            :disabled="!email || !password"
          >
            登录 / 注册
          </Button>
          <Button
            variant="outline"
            class="w-full"
            @click="disconnect"
          >
            断开连接
          </Button>
        </template>
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
