<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, Plus, Trash2 } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Separator } from '@/components/ui/separator'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig, ModelConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'

const router = useRouter()

const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
const editingModel = ref<ModelConfig>({
  id: '',
  name: '',
  provider: 'OpenAI',
  apiBase: 'https://api.openai.com/v1',
  apiKey: '',
  model: 'gpt-4o',
  maxTokens: 4096,
  temperature: 0.8,
  topP: 1,
})

async function loadConfig() {
  config.value = await getConfig()
}

function addModel() {
  const model = { ...editingModel.value, id: crypto.randomUUID() }
  config.value.models.push(model)
  saveConfig(config.value)
}

function removeModel(id: string) {
  config.value.models = config.value.models.filter((m) => m.id !== id)
  saveConfig(config.value)
}

loadConfig()
</script>

<template>
  <div class="p-4">
    <header class="flex items-center gap-3 mb-6">
      <button class="size-8 flex items-center justify-center" @click="router.back()">
        <ArrowLeft class="size-5" />
      </button>
      <h1 class="text-xl font-bold">模型配置</h1>
    </header>

    <!-- Saved Models -->
    <div v-if="config.models.length > 0" class="mb-6">
      <h2 class="text-sm font-medium mb-2">已配置的模型</h2>
      <div class="space-y-2">
        <div
          v-for="m in config.models"
          :key="m.id"
          class="flex items-center justify-between rounded-lg border px-3 py-2"
        >
          <div>
            <p class="text-sm font-medium">{{ m.name }}</p>
            <p class="text-xs text-muted-foreground">{{ m.provider }} — {{ m.model }}</p>
          </div>
          <button
            class="size-8 flex items-center justify-center text-muted-foreground hover:text-destructive"
            @click="removeModel(m.id)"
          >
            <Trash2 class="size-4" />
          </button>
        </div>
      </div>
    </div>

    <Separator class="my-6" />

    <!-- Add Model Form -->
    <h2 class="text-sm font-medium mb-3">添加新模型</h2>
    <div class="space-y-3">
      <div>
        <Label>名称</Label>
        <Input v-model="editingModel.name" placeholder="我的 GPT-4o" />
      </div>
      <div>
        <Label>提供商</Label>
        <Select v-model="editingModel.provider">
          <SelectTrigger>
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="OpenAI">OpenAI</SelectItem>
            <SelectItem value="DeepSeek">DeepSeek</SelectItem>
            <SelectItem value="Custom">自定义</SelectItem>
          </SelectContent>
        </Select>
      </div>
      <div>
        <Label>API 地址</Label>
        <Input v-model="editingModel.apiBase" placeholder="https://api.openai.com/v1" />
      </div>
      <div>
        <Label>API Key</Label>
        <Input v-model="editingModel.apiKey" type="password" placeholder="sk-..." />
      </div>
      <div>
        <Label>模型名</Label>
        <Input v-model="editingModel.model" placeholder="gpt-4o" />
      </div>
      <div>
        <Label>最大 Token</Label>
        <Input v-model.number="editingModel.maxTokens" type="number" />
      </div>
      <div>
        <Label>温度: {{ editingModel.temperature }}</Label>
        <Slider
          :model-value="[editingModel.temperature]"
          :min="0"
          :max="2"
          :step="0.1"
          @update:model-value="
            (v) => {
              if (v) editingModel.temperature = v[0]
            }
          "
        />
      </div>
    </div>

    <Button
      class="mt-4 w-full"
      :disabled="!editingModel.name || !editingModel.apiKey"
      @click="addModel"
    >
      <Plus class="size-4 mr-1.5" />
      添加模型
    </Button>
  </div>
</template>
