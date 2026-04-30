<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Server } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'

const router = useRouter()
const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
const backendUrl = ref('')
const email = ref('')
const password = ref('')
const connected = ref(false)

async function loadConfig() {
  config.value = await getConfig()
  backendUrl.value = config.value.backendUrl ?? ''
}

function connect() {
  config.value.backendUrl = backendUrl.value
  saveConfig(config.value)
  connected.value = true
}

function disconnect() {
  config.value.backendUrl = ''
  saveConfig(config.value)
  connected.value = false
  backendUrl.value = ''
}

loadConfig()
</script>

<template>
  <div class="p-4">
    <header class="flex items-center gap-3 mb-6">
      <button class="size-8 flex items-center justify-center" @click="router.back()">
        <ArrowLeft class="size-5" />
      </button>
      <h1 class="text-xl font-bold">后端连接</h1>
    </header>

    <div class="rounded-lg border p-4 mb-4">
      <div class="flex items-center gap-3 mb-4">
        <Server class="size-5 text-muted-foreground" />
        <p class="text-sm text-muted-foreground">
          连接后端可以跨设备同步数据，并使用后端代理调用 LLM
        </p>
      </div>

      <div class="space-y-3">
        <div>
          <Label>服务器地址</Label>
          <Input v-model="backendUrl" placeholder="https://storyclaw.example.com" />
        </div>

        <div v-if="connected">
          <Label>邮箱</Label>
          <Input v-model="email" placeholder="your@email.com" />
        </div>
        <div v-if="connected">
          <Label>密码</Label>
          <Input v-model="password" type="password" />
        </div>
      </div>
    </div>

    <Button v-if="!connected" class="w-full" :disabled="!backendUrl" @click="connect">
      连接
    </Button>
    <template v-else>
      <Button class="w-full mb-2" :disabled="!email || !password"> 登录 / 注册 </Button>
      <Button variant="outline" class="w-full" @click="disconnect"> 断开连接 </Button>
    </template>

    <p class="text-xs text-muted-foreground text-center mt-4">
      也可以不连接后端，直接使用本地模式。所有数据存储在浏览器中。
    </p>
  </div>
</template>
