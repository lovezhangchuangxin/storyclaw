<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { Plus, Trash2, Pen, Star, Settings, Bot, Server, Shield } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig, ModelConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'
import { modelLabel } from '@/lib/model-utils'
import { useAuthStore } from '@/stores/auth'
import { useBackendModelsStore } from '@/stores/backendModels'
import ModelDialog from './components/ModelDialog.vue'

const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
const dialogOpen = ref(false)
const editingModel = ref<ModelConfig | null>(null)
const auth = useAuthStore()
const backendModels = useBackendModelsStore()

async function loadConfig() {
  try {
    config.value = await getConfig()
  } catch (e) {
    toast.error('加载配置失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

function openAdd() {
  editingModel.value = null
  dialogOpen.value = true
}

function openEdit(model: ModelConfig) {
  editingModel.value = { ...model }
  dialogOpen.value = true
}

function openBackendAdd() {
  editingModel.value = null
  dialogOpen.value = true
}

function openBackendEdit(bm: import('@/db/types').BackendModelConfig) {
  editingModel.value = {
    id: `backend-${bm.id}`,
    provider: bm.provider,
    apiBase: '',
    apiKey: '',
    model: bm.model,
    maxOutputTokens: bm.maxOutputTokens,
    contextWindowTokens: bm.contextWindowTokens,
    outputReserveTokens: 0,
    compactionTriggerRatio: 0.85,
    compactionTargetRatio: 0.7,
    isBackendModel: true,
    backendId: bm.id,
  }
  dialogOpen.value = true
}

async function handleSave(model: ModelConfig) {
  if (model.isBackendModel) {
    await handleSaveBackendModel(model)
    return
  }

  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  if (editingModel.value?.id) {
    const idx = snapshot.models.findIndex((m) => m.id === editingModel.value!.id)
    if (idx !== -1) snapshot.models[idx] = model
  } else {
    snapshot.models.push(model)
    if (!snapshot.defaultModelId) {
      snapshot.defaultModelId = model.id
    }
  }
  try {
    await saveConfig(snapshot)
    config.value = snapshot
    toast.success(editingModel.value?.id ? '模型已更新' : '模型已添加')
  } catch (e) {
    toast.error('保存失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function handleSaveBackendModel(model: ModelConfig) {
  const data: any = {
    name: (model as any).name || model.provider,
    provider: model.provider,
    apiBase: model.apiBase || 'https://api.openai.com/v1',
    model: model.model,
    maxOutputTokens: model.maxOutputTokens,
    contextWindowTokens: model.contextWindowTokens,
    isPublic: (model as any).isPublic ?? false,
  }
  if (model.apiKey) {
    data.apiKey = model.apiKey
  }

  try {
    if (model.backendId && editingModel.value?.backendId) {
      await backendModels.update(model.backendId, data)
      toast.success('后端模型已更新')
    } else {
      if (!model.apiKey) {
        toast.error('请输入 API Key')
        return
      }
      await backendModels.create(data)
      toast.success('后端模型已添加')
    }
    await backendModels.fetchModels()
  } catch (e) {
    toast.error('操作失败', {
      description: e instanceof Error ? e.message : '请检查后端连接',
    })
  }
}

async function removeBackendModel(id: string) {
  try {
    await backendModels.remove(id)
    toast.success('后端模型已删除')
  } catch (e) {
    toast.error('删除失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function removeModel(id: string) {
  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  snapshot.models = snapshot.models.filter((m) => m.id !== id)
  if (snapshot.defaultModelId === id) {
    snapshot.defaultModelId = snapshot.models[0]?.id ?? ''
  }
  for (const skill of Object.keys(snapshot.skillModelMapping)) {
    if (snapshot.skillModelMapping[skill] === id) {
      delete snapshot.skillModelMapping[skill]
    }
  }
  try {
    await saveConfig(snapshot)
    config.value = snapshot
  } catch (e) {
    toast.error('删除失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function setDefault(id: string) {
  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  snapshot.defaultModelId = id
  try {
    await saveConfig(snapshot)
    config.value = snapshot
  } catch (e) {
    toast.error('设置默认失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

function providerDotClass(provider: string): string {
  const map: Record<string, string> = {
    DeepSeek: 'bg-blue-100 text-blue-700 dark:bg-blue-900/40 dark:text-blue-300',
    Zhipu: 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/40 dark:text-emerald-300',
    MiniMax: 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300',
  }
  return map[provider] ?? 'bg-muted text-muted-foreground'
}

loadConfig()
onMounted(() => {
  if (auth.isAuthenticated) {
    backendModels.fetchModels()
  }
})
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

    <!-- Model List Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <!-- Section Header -->
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Settings class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">模型配置</h3>
        </div>
        <p class="text-xs text-muted-foreground">管理 AI 模型接入信息</p>
      </div>

      <!-- Model list -->
      <div v-if="config.models.length > 0" class="space-y-2">
        <div
          v-for="m in config.models"
          :key="m.id"
          class="flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-all duration-200"
          :class="m.id === config.defaultModelId
            ? 'border-primary/30 bg-card shadow-md'
            : 'hover:shadow-md hover:border-border'"
        >
          <!-- Provider icon -->
          <div
            class="size-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold"
            :class="providerDotClass(m.provider)"
          >
            {{ m.provider.charAt(0).toUpperCase() }}
          </div>

          <!-- Model info -->
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium truncate">{{ modelLabel(m) }}</p>
              <span
                v-if="m.id === config.defaultModelId"
                class="inline-flex items-center gap-1 text-[11px] px-2 py-0.5 rounded-full border border-primary/15 text-primary/60 font-medium shrink-0"
              >
                <span class="size-1.5 rounded-full bg-primary/30" />
                默认
              </span>
            </div>
            <p class="text-xs text-muted-foreground truncate mt-0.5">{{ m.apiBase }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              v-if="m.id !== config.defaultModelId"
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
              title="设为默认"
              @click="setDefault(m.id)"
            >
              <Star class="size-3.5" />
            </button>
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              title="编辑"
              @click="openEdit(m)"
            >
              <Pen class="size-3.5" />
            </button>
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              title="删除"
              @click="removeModel(m.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div
        v-else
        class="flex flex-col items-center justify-center py-16 text-muted-foreground"
      >
        <Bot class="size-10 mb-3 text-muted-foreground/30" />
        <p class="text-sm font-medium mb-1">还没有配置模型</p>
        <p class="text-xs">添加一个 AI 模型来开始故事创作</p>
      </div>
    </section>

    <!-- Add Button -->
    <Button class="w-full cursor-pointer" @click="openAdd">
      <Plus class="size-4 mr-1.5" />
      添加模型
    </Button>

    <!-- Backend Models Section -->
    <section
      v-if="auth.isAuthenticated && (backendModels.models.length > 0 || auth.isAdmin)"
      class="rounded-xl border bg-card shadow-sm p-5 space-y-4"
    >
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Server class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">后端模型</h3>
          <span class="text-[11px] px-1.5 py-0.5 rounded-full border text-muted-foreground">后端</span>
        </div>
        <p class="text-xs text-muted-foreground">管理员配置的共享模型，所有用户可见</p>
      </div>

      <div v-if="backendModels.loading" class="text-xs text-muted-foreground py-4 text-center">
        加载中...
      </div>

      <div v-else-if="backendModels.models.length === 0" class="text-xs text-muted-foreground py-4 text-center">
        {{ auth.isAdmin ? '还没有配置后端模型，点击下方按钮添加' : '暂无可用后端模型' }}
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="bm in backendModels.models"
          :key="bm.id"
          class="flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-all duration-200 hover:shadow-md"
        >
          <div class="size-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold"
            :class="providerDotClass(bm.provider)">
            {{ bm.provider.charAt(0).toUpperCase() }}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium truncate">{{ bm.name }}</p>
              <span class="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0">
                {{ bm.model }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground truncate mt-0.5">{{ bm.provider }} · {{ bm.contextWindowTokens / 1000 }}K</p>
          </div>

          <div v-if="bm.canEdit" class="flex items-center gap-0.5 shrink-0">
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              title="编辑"
              @click="openBackendEdit(bm)"
            >
              <Pen class="size-3.5" />
            </button>
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              title="删除"
              @click="removeBackendModel(bm.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
          <Shield v-else class="size-3.5 text-muted-foreground/40 shrink-0" title="仅管理员可编辑" />
        </div>
      </div>

      <Button v-if="auth.isAdmin" variant="outline" class="w-full cursor-pointer text-xs" @click="openBackendAdd">
        <Plus class="size-3.5 mr-1" />
        添加后端模型
      </Button>
    </section>

    <ModelDialog
      :open="dialogOpen"
      :model="editingModel"
      @update:open="dialogOpen = $event"
      @save="handleSave"
    />
  </div>
</template>
