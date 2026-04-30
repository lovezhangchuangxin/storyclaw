<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, Pen, Star, Settings, Bot } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig, ModelConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'
import { modelLabel } from '@/lib/model-utils'
import ModelDialog from './components/ModelDialog.vue'

const config = ref<AppConfig>({ ...DEFAULT_CONFIG })
const dialogOpen = ref(false)
const editingModel = ref<ModelConfig | null>(null)

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

async function handleSave(model: ModelConfig) {
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
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

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
                class="inline-flex items-center text-[11px] px-1.5 py-0.5 rounded-md bg-primary/15 text-primary font-medium shrink-0"
              >默认</span>
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

    <ModelDialog
      :open="dialogOpen"
      :model="editingModel"
      @update:open="dialogOpen = $event"
      @save="handleSave"
    />
  </div>
</template>
