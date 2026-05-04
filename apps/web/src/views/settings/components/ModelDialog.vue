<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { Eye, EyeOff, Loader2, Zap, Globe, X } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import Combobox from './Combobox.vue'
import { createDefaultModelConfig, type ModelConfig } from '@/db/types'
import {
  PROVIDER_NAMES,
  getApiBaseForProvider,
  fetchModels,
} from '@/lib/provider-data'
import { testConnection } from '@/lib/test-connection'

const props = defineProps<{
  open: boolean
  model?: ModelConfig | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  save: [model: ModelConfig]
}>()

const provider = ref('')
const apiBase = ref('')
const apiKey = ref('')
const model = ref('')
const maxOutputTokens = ref('16384')
const contextWindowTokens = ref('128000')
const outputReserveTokens = ref('4096')
const compactionTriggerRatio = ref('0.7')
const compactionTargetRatio = ref('0.2')
const summaryModelId = ref('')
const showKey = ref(false)
const modelsLoading = ref(false)
const testing = ref(false)
const fetchedModels = ref<string[]>([])
const modelName = ref('')
const isPublic = ref(false)
let populating = false
let fetchSeq = 0

const isEdit = computed(() => !!props.model?.id)
const isBackend = computed(() => !!props.model?.isBackendModel)
const title = computed(() => {
  if (isBackend.value) return isEdit.value ? '编辑后端模型' : '添加后端模型'
  return isEdit.value ? '编辑模型' : '添加模型'
})

// Test button: disabled if testing, or if required fields are missing
const testDisabled = computed(() => {
  if (testing.value) return true
  if (isBackend.value) {
    // Backend models only need model name for test
    return !model.value
  }
  // Regular models need apiBase, apiKey, and model
  return !apiBase.value || !apiKey.value || !model.value
})

// Save button: disabled if required fields are missing
const saveDisabled = computed(() => {
  if (!provider.value || !model.value) return true
  if (isBackend.value && isEdit.value) {
    // Editing backend model: apiBase/apiKey optional
    return false
  }
  // All other cases need apiBase and apiKey
  return !apiBase.value || !apiKey.value
})

const modelOptions = computed(() => fetchedModels.value)

watch(() => props.open, (val) => {
  if (!val) return
  populating = true
  fetchedModels.value = []
  const fallback = createDefaultModelConfig({
    id: props.model?.id ?? crypto.randomUUID(),
    provider: props.model?.provider ?? '',
    apiBase: props.model?.apiBase ?? '',
    apiKey: props.model?.apiKey ?? '',
    model: props.model?.model ?? '',
  })
  if (props.model) {
    provider.value = props.model.provider
    apiBase.value = props.model.apiBase
    apiKey.value = props.model.apiKey
    model.value = props.model.model
    modelName.value = props.model.name ?? ''
    isPublic.value = props.model.isPublic ?? false
    maxOutputTokens.value = String(props.model.maxOutputTokens ?? fallback.maxOutputTokens)
    contextWindowTokens.value = String(props.model.contextWindowTokens ?? fallback.contextWindowTokens)
    outputReserveTokens.value = String(props.model.outputReserveTokens ?? fallback.outputReserveTokens)
    compactionTriggerRatio.value = String(props.model.compactionTriggerRatio ?? fallback.compactionTriggerRatio)
    compactionTargetRatio.value = String(props.model.compactionTargetRatio ?? fallback.compactionTargetRatio)
    summaryModelId.value = props.model.summaryModelId ?? ''
  } else {
    provider.value = ''
    apiBase.value = ''
    apiKey.value = ''
    model.value = ''
    modelName.value = ''
    isPublic.value = false
    maxOutputTokens.value = String(fallback.maxOutputTokens)
    contextWindowTokens.value = String(fallback.contextWindowTokens)
    outputReserveTokens.value = String(fallback.outputReserveTokens)
    compactionTriggerRatio.value = String(fallback.compactionTriggerRatio)
    compactionTargetRatio.value = String(fallback.compactionTargetRatio)
    summaryModelId.value = ''
  }
  populating = false
})

watch(provider, (p) => {
  if (populating) return
  fetchedModels.value = []
  const base = getApiBaseForProvider(p)
  if (base) apiBase.value = base
  if (!modelOptions.value.includes(model.value)) {
    model.value = ''
  }
})

watch([apiBase, apiKey], () => {
  fetchedModels.value = []
})

function toNumber(value: string, fallback: number): number {
  if (!value.trim()) return fallback
  const parsed = Number(value)
  return Number.isFinite(parsed) ? parsed : fallback
}

async function handleModelComboOpen() {
  if (fetchedModels.value.length || modelsLoading.value) return
  if (!apiBase.value || !apiKey.value) return
  const seq = ++fetchSeq
  modelsLoading.value = true
  try {
    const models = await fetchModels(apiBase.value, apiKey.value)
    if (seq !== fetchSeq) return
    fetchedModels.value = models
  } catch {
    if (seq !== fetchSeq) return
    fetchedModels.value = []
  } finally {
    if (seq === fetchSeq) modelsLoading.value = false
  }
}

async function handleTest() {
  testing.value = true
  try {
    await testConnection(apiBase.value, apiKey.value, model.value)
    toast.success('连接成功')
  } catch (e: unknown) {
    toast.error('连接失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  } finally {
    testing.value = false
  }
}

function handleSave() {
  const saved: ModelConfig = {
    id: props.model?.id ?? crypto.randomUUID(),
    provider: provider.value,
    apiBase: apiBase.value,
    apiKey: apiKey.value,
    model: model.value,
    maxOutputTokens: toNumber(maxOutputTokens.value, 16384),
    contextWindowTokens: toNumber(contextWindowTokens.value, 128000),
    outputReserveTokens: toNumber(outputReserveTokens.value, 4096),
    compactionTriggerRatio: toNumber(compactionTriggerRatio.value, 0.7),
    compactionTargetRatio: toNumber(compactionTargetRatio.value, 0.2),
    summaryModelId: summaryModelId.value.trim(),
    isBackendModel: props.model?.isBackendModel ?? false,
    backendId: props.model?.backendId ?? undefined,
    // Only set name if non-empty after trimming; otherwise modelLabel() will fallback to "provider — model"
    ...(modelName.value.trim() ? { name: modelName.value.trim() } : {}),
    isPublic: isPublic.value,
  }
  emit('save', saved)
  emit('update:open', false)
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-sm">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 mt-2">
        <div class="space-y-1.5">
          <Label>模型名称</Label>
          <Input
            v-model="modelName"
            placeholder="选填，默认为 提供商 - 模型ID"
            class="focus-visible:ring-0"
          />
        </div>

        <div class="space-y-1.5">
          <Label>提供商</Label>
          <Combobox
            v-model="provider"
            :options="PROVIDER_NAMES"
            placeholder="选择或输入提供商"
          />
        </div>

        <div class="space-y-1.5">
          <Label>API 地址</Label>
          <Input
            v-model="apiBase"
            :placeholder="isBackend && isEdit ? '(已配置)' : 'https://api.openai.com/v1'"
            class="focus-visible:ring-0"
          />
          <p v-if="isBackend && isEdit" class="text-[11px] text-muted-foreground">
            留空则保留已配置的 API 地址。仅在你需要更改时填写。
          </p>
        </div>

        <div class="space-y-1.5">
          <Label>API Key</Label>
          <div class="group relative">
            <Input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              autocomplete="off"
              data-1p-ignore
              :placeholder="isBackend && isEdit ? '(已配置，填写则更新)' : 'sk-······'"
              class="focus-visible:ring-0 pr-9"
            />
            <div class="absolute right-2 top-1/2 -translate-y-1/2 flex items-center gap-1">
              <button
                v-if="isBackend && isEdit && apiKey"
                type="button"
                class="text-muted-foreground hover:text-destructive transition-opacity"
                title="清空 API Key"
                @click="apiKey = ''"
              >
                <X class="size-4" />
              </button>
              <button
                type="button"
                class="text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
                @click="showKey = !showKey"
              >
                <Eye v-if="!showKey" class="size-4" />
                <EyeOff v-else class="size-4" />
              </button>
            </div>
          </div>
          <p v-if="isBackend && isEdit" class="text-[11px] text-muted-foreground">
            留空则保留已配置的 API Key。填写新值则更新，点击 × 按钮清空。
          </p>
        </div>

        <div class="space-y-1.5">
          <Label class="flex items-center gap-1.5">
            模型 ID
            <Loader2 v-if="modelsLoading" class="size-3.5 animate-spin text-muted-foreground" />
          </Label>
          <Combobox
            v-model="model"
            :options="modelOptions"
            placeholder="选择或输入模型名"
            @open="handleModelComboOpen"
          />
        </div>

        <div v-if="isBackend" class="flex items-center justify-between px-1 py-2">
          <div>
            <Label class="flex items-center gap-1.5">
              <Globe class="size-3" />
              公开模型
            </Label>
            <p class="text-[11px] text-muted-foreground mt-0.5">开启后所有用户可见和使用</p>
          </div>
          <Switch v-model="isPublic" />
        </div>

        <div class="space-y-3 rounded-lg border border-dashed p-3">
          <div>
            <p class="text-xs font-medium">上下文管理</p>
            <p class="text-[11px] text-muted-foreground">
              {{ isBackend ? '后端模型的上下文压缩在前端执行，可自定义配置。' : '控制窗口预算、自动压缩阈值和摘要模型。' }}
            </p>
          </div>

          <div class="grid grid-cols-2 gap-2">
            <div class="space-y-1.5">
              <Label class="text-xs">最大输出</Label>
              <Input v-model="maxOutputTokens" type="number" min="1" class="focus-visible:ring-0" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">上下文窗口</Label>
              <Input v-model="contextWindowTokens" type="number" min="1" class="focus-visible:ring-0" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">输出预留</Label>
              <Input v-model="outputReserveTokens" type="number" min="0" class="focus-visible:ring-0" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">触发比例</Label>
              <Input v-model="compactionTriggerRatio" type="number" min="0" max="1" step="0.05" class="focus-visible:ring-0" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">目标比例</Label>
              <Input v-model="compactionTargetRatio" type="number" min="0" max="1" step="0.05" class="focus-visible:ring-0" />
            </div>
            <div class="space-y-1.5">
              <Label class="text-xs">摘要模型 ID</Label>
              <Input v-model="summaryModelId" placeholder="留空则复用当前模型" class="focus-visible:ring-0" />
            </div>
          </div>
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <Button variant="outline" :disabled="testDisabled" @click="handleTest">
          <Loader2 v-if="testing" class="size-4 animate-spin mr-1.5" />
          <Zap v-else class="size-4 mr-1.5" />
          测试
        </Button>
        <Button variant="outline" @click="emit('update:open', false)">取消</Button>
        <Button :disabled="saveDisabled" @click="handleSave">
          {{ isEdit ? '保存' : '添加' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
