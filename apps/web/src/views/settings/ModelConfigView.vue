<script setup lang="ts">
import { ref } from 'vue'
import { Plus, Trash2, Pen, Star } from 'lucide-vue-next'
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
  config.value = await getConfig()
}

function openAdd() {
  editingModel.value = null
  dialogOpen.value = true
}

function openEdit(model: ModelConfig) {
  editingModel.value = { ...model }
  dialogOpen.value = true
}

function handleSave(model: ModelConfig) {
  if (editingModel.value?.id) {
    const idx = config.value.models.findIndex((m) => m.id === editingModel.value!.id)
    if (idx !== -1) config.value.models[idx] = model
  } else {
    config.value.models.push(model)
    if (!config.value.defaultModelId) {
      config.value.defaultModelId = model.id
    }
  }
  saveConfig(config.value)
}

function removeModel(id: string) {
  config.value.models = config.value.models.filter((m) => m.id !== id)
  if (config.value.defaultModelId === id) {
    config.value.defaultModelId = config.value.models[0]?.id ?? ''
  }
  for (const skill of Object.keys(config.value.skillModelMapping)) {
    if (config.value.skillModelMapping[skill] === id) {
      delete config.value.skillModelMapping[skill]
    }
  }
  saveConfig(config.value)
}

function setDefault(id: string) {
  config.value.defaultModelId = id
  saveConfig(config.value)
}

loadConfig()
</script>

<template>
  <div class="p-4">
    <!-- Model list -->
    <div v-if="config.models.length > 0" class="space-y-2 mb-4">
      <div
        v-for="m in config.models"
        :key="m.id"
        class="flex items-center gap-2 rounded-lg border px-3 py-2.5"
        :class="m.id === config.defaultModelId ? 'border-primary/50 bg-primary/5' : ''"
      >
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium truncate">{{ modelLabel(m) }}</p>
          <p class="text-xs text-muted-foreground truncate">{{ m.apiBase }}</p>
        </div>
        <button
          v-if="m.id !== config.defaultModelId"
          class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
          title="设为默认"
          @click="setDefault(m.id)"
        >
          <Star class="size-4" />
        </button>
        <span
          v-else
          class="text-xs text-primary font-medium shrink-0"
        >默认</span>
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

    <!-- Empty state -->
    <div
      v-else
      class="flex flex-col items-center justify-center py-16 text-muted-foreground"
    >
      <p class="text-sm mb-1">还没有配置模型</p>
      <p class="text-xs">添加一个模型以开始创作</p>
    </div>

    <Button class="w-full" @click="openAdd">
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
