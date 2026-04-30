<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { Eye, EyeOff, Loader2 } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import Combobox from './Combobox.vue'
import type { ModelConfig } from '@/db/types'
import {
  PROVIDER_NAMES,
  getModelsForProvider,
  getApiBaseForProvider,
  getMaxTokensForModel,
  fetchModels,
} from '@/lib/provider-data'

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
const maxTokens = ref(4096)
const showKey = ref(false)
const modelsLoading = ref(false)
const fetchedModels = ref<string[]>([])
let populating = false
let fetchSeq = 0

const isEdit = computed(() => !!props.model?.id)
const title = computed(() => isEdit.value ? '编辑模型' : '添加模型')

const modelOptions = computed(() => {
  if (fetchedModels.value.length) return fetchedModels.value
  return getModelsForProvider(provider.value)
})
const tokenFromModel = computed(() => getMaxTokensForModel(model.value))
const tokenEditable = computed(() => !tokenFromModel.value)

watch(() => props.open, (val) => {
  if (!val) return
  populating = true
  fetchedModels.value = []
  if (props.model) {
    provider.value = props.model.provider
    apiBase.value = props.model.apiBase
    apiKey.value = props.model.apiKey
    model.value = props.model.model
    maxTokens.value = props.model.maxTokens
  } else {
    provider.value = ''
    apiBase.value = ''
    apiKey.value = ''
    model.value = ''
    maxTokens.value = 4096
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

watch([apiBase, apiKey], async ([base, key]) => {
  if (populating || !base || !key) {
    fetchedModels.value = []
    return
  }
  const seq = ++fetchSeq
  modelsLoading.value = true
  try {
    const models = await fetchModels(base, key)
    if (seq !== fetchSeq) return
    fetchedModels.value = models
  } catch {
    if (seq !== fetchSeq) return
    fetchedModels.value = []
  } finally {
    if (seq === fetchSeq) modelsLoading.value = false
  }
})

watch(model, (m) => {
  if (populating) return
  const t = getMaxTokensForModel(m)
  if (t) maxTokens.value = t
})

function handleSave() {
  emit('save', {
    id: props.model?.id ?? crypto.randomUUID(),
    provider: provider.value,
    apiBase: apiBase.value,
    apiKey: apiKey.value,
    model: model.value,
    maxTokens: maxTokens.value,
  })
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
          <Label>提供商</Label>
          <Combobox
            v-model="provider"
            :options="PROVIDER_NAMES"
            placeholder="选择或输入提供商"
          />
        </div>

        <div class="space-y-1.5">
          <Label>API 地址</Label>
          <Input v-model="apiBase" placeholder="https://api.openai.com/v1" class="focus-visible:ring-0" />
        </div>

        <div class="space-y-1.5">
          <Label>API Key</Label>
          <div class="group relative">
            <Input
              v-model="apiKey"
              :type="showKey ? 'text' : 'password'"
              autocomplete="off"
              data-1p-ignore
              placeholder="sk-······"
              class="focus-visible:ring-0 pr-9"
            />
            <button
              type="button"
              class="absolute right-2 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground opacity-0 group-hover:opacity-100 transition-opacity"
              @click="showKey = !showKey"
            >
              <Eye v-if="!showKey" class="size-4" />
              <EyeOff v-else class="size-4" />
            </button>
          </div>
        </div>

        <div class="space-y-1.5">
          <Label class="flex items-center gap-1.5">
            模型名
            <Loader2 v-if="modelsLoading" class="size-3.5 animate-spin text-muted-foreground" />
          </Label>
          <Combobox
            v-model="model"
            :options="modelOptions"
            placeholder="选择或输入模型名"
          />
        </div>

        <div class="space-y-1.5">
          <Label>最大 Token</Label>
          <Input
            v-model.number="maxTokens"
            type="number"
            :readonly="!tokenEditable"
            :class="!tokenEditable ? 'text-muted-foreground' : ''"
            class="focus-visible:ring-0"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <Button variant="outline" @click="emit('update:open', false)">取消</Button>
        <Button :disabled="!provider || !apiBase || !apiKey || !model" @click="handleSave">
          {{ isEdit ? '保存' : '添加' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
