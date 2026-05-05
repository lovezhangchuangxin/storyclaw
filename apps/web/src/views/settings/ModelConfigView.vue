<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useI18n } from 'vue-i18n'
import { Plus, Trash2, Pen, Star, Settings, Bot, Server, Shield } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { saveConfig, getConfig } from '@/db/config'
import type {
  AppConfig,
  ModelConfig,
  BackendModelConfig,
  CreateBackendModelRequest,
  UpdateBackendModelRequest,
} from '@/db/types'
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
const { t } = useI18n()

async function loadConfig() {
  try {
    config.value = await getConfig()
  } catch (e) {
    toast.error(t('common.loadConfigFailed'), {
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
  editingModel.value = {
    id: crypto.randomUUID(),
    provider: '',
    apiBase: '',
    apiKey: '',
    model: '',
    // Default values matching createDefaultModelConfig
    maxOutputTokens: 16384,
    contextWindowTokens: 128000,
    outputReserveTokens: 4096,
    compactionTriggerRatio: 0.7,
    compactionTargetRatio: 0.2,
    summaryModelId: '',
    isBackendModel: true,
    backendId: undefined, // New model, no backend ID yet
  }
  dialogOpen.value = true
}

function openBackendEdit(bm: BackendModelConfig) {
  editingModel.value = {
    id: `backend-${bm.id}`,
    provider: bm.provider,
    apiBase: '',
    apiKey: '',
    model: bm.model,
    // Backend provides these values
    maxOutputTokens: bm.maxOutputTokens,
    contextWindowTokens: bm.contextWindowTokens,
    // Use same compaction defaults as user-configured models
    outputReserveTokens: 4096,
    compactionTriggerRatio: 0.7,
    compactionTargetRatio: 0.2,
    summaryModelId: '',
    isBackendModel: true,
    backendId: bm.id,
    isPublic: bm.isPublic,
    name: bm.name,
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
    toast.success(
      editingModel.value?.id
        ? t('settings.modelConfig.modelUpdated')
        : t('settings.modelConfig.modelAdded'),
    )
  } catch (e) {
    toast.error(t('common.saveFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

async function handleSaveBackendModel(model: ModelConfig) {
  try {
    if (model.backendId && editingModel.value?.backendId) {
      // Update: only include apiBase/apiKey if admin explicitly filled them in
      const updateData: UpdateBackendModelRequest = {
        name: model.name?.trim() || undefined,
        provider: model.provider,
        model: model.model,
        maxOutputTokens: model.maxOutputTokens,
        contextWindowTokens: model.contextWindowTokens,
        isPublic: model.isPublic ?? false,
      }
      if (model.apiBase) updateData.apiBase = model.apiBase
      if (model.apiKey) updateData.apiKey = model.apiKey

      await backendModels.update(model.backendId, updateData)
      toast.success(t('settings.modelConfig.backendModels.modelUpdated'))
    } else {
      if (!model.apiKey) {
        toast.error(t('settings.modelConfig.backendModels.apiKeyRequired'))
        return
      }
      const createData: CreateBackendModelRequest = {
        name: model.name?.trim() || model.model || 'Unnamed',
        provider: model.provider,
        apiBase: model.apiBase || 'https://api.openai.com/v1',
        apiKey: model.apiKey,
        model: model.model,
        maxOutputTokens: model.maxOutputTokens,
        contextWindowTokens: model.contextWindowTokens,
        isPublic: model.isPublic ?? false,
      }

      await backendModels.create(createData)
      toast.success(t('settings.modelConfig.backendModels.modelAdded'))
    }
    await backendModels.fetchModels()
  } catch (e) {
    toast.error(t('settings.modelConfig.backendModels.operationFailed'), {
      description:
        e instanceof Error ? e.message : t('settings.modelConfig.backendModels.checkConnection'),
    })
  }
}

async function removeBackendModel(id: string) {
  try {
    await backendModels.remove(id)
    toast.success(t('settings.modelConfig.backendModels.modelDeleted'))
  } catch (e) {
    toast.error(t('common.deleteFailed'), {
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
    toast.error(t('common.deleteFailed'), {
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
    toast.error(t('common.saveFailed'), {
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
          <h3 class="text-sm font-medium">{{ $t('settings.modelConfig.title') }}</h3>
        </div>
        <p class="text-xs text-muted-foreground">{{ $t('settings.modelConfig.description') }}</p>
      </div>

      <!-- Model list -->
      <div v-if="config.models.length > 0" class="space-y-2">
        <div
          v-for="m in config.models"
          :key="m.id"
          class="flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-all duration-200"
          :class="
            m.id === config.defaultModelId
              ? 'border-primary/30 bg-card shadow-md'
              : 'hover:shadow-md hover:border-border'
          "
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
                {{ $t('common.default') }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground truncate mt-0.5">{{ m.apiBase }}</p>
          </div>

          <!-- Actions -->
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              v-if="m.id !== config.defaultModelId"
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-primary transition-colors"
              :title="$t('settings.modelConfig.setDefault')"
              @click="setDefault(m.id)"
            >
              <Star class="size-3.5" />
            </button>
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              :title="$t('common.edit')"
              @click="openEdit(m)"
            >
              <Pen class="size-3.5" />
            </button>
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              :title="$t('common.delete')"
              @click="removeModel(m.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty state -->
      <div v-else class="flex flex-col items-center justify-center py-16 text-muted-foreground">
        <Bot class="size-10 mb-3 text-muted-foreground/30" />
        <p class="text-sm font-medium mb-1">{{ $t('settings.modelConfig.empty.title') }}</p>
        <p class="text-xs">{{ $t('settings.modelConfig.empty.description') }}</p>
      </div>
    </section>

    <!-- Add Button -->
    <Button class="w-full cursor-pointer" @click="openAdd">
      <Plus class="size-4 mr-1.5" />
      {{ $t('settings.modelConfig.addModel') }}
    </Button>

    <!-- Backend Models Section -->
    <section v-if="auth.isAuthenticated" class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Server class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">{{ $t('settings.modelConfig.backendModels.title') }}</h3>
          <span class="text-[11px] px-1.5 py-0.5 rounded-full border text-muted-foreground">{{
            $t('settings.modelConfig.backendModels.label')
          }}</span>
        </div>
        <p class="text-xs text-muted-foreground">
          {{ $t('settings.modelConfig.backendModels.description') }}
        </p>
      </div>

      <div
        v-if="backendModels.error"
        class="text-xs text-destructive bg-destructive/10 rounded px-3 py-2"
      >
        {{ backendModels.error }}
      </div>

      <div v-if="backendModels.loading" class="text-xs text-muted-foreground py-4 text-center">
        {{ $t('common.loading') }}
      </div>

      <div
        v-else-if="backendModels.models.length === 0"
        class="text-xs text-muted-foreground py-4 text-center"
      >
        {{
          auth.isAdmin
            ? $t('settings.modelConfig.backendModels.noModels')
            : $t('settings.modelConfig.backendModels.noModelsUser')
        }}
      </div>

      <div v-else class="space-y-2">
        <div
          v-for="bm in backendModels.models"
          :key="bm.id"
          class="flex items-center gap-3 rounded-lg border px-3.5 py-3 transition-all duration-200 hover:shadow-md"
        >
          <div
            class="size-9 rounded-lg flex items-center justify-center shrink-0 text-xs font-semibold"
            :class="providerDotClass(bm.provider)"
          >
            {{ bm.provider.charAt(0).toUpperCase() }}
          </div>

          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-2">
              <p class="text-sm font-medium truncate">{{ bm.name }}</p>
              <span
                class="text-[11px] px-1.5 py-0.5 rounded-full bg-muted text-muted-foreground shrink-0"
              >
                {{ bm.model }}
              </span>
            </div>
            <p class="text-xs text-muted-foreground truncate mt-0.5">
              {{ bm.provider }} · {{ bm.contextWindowTokens / 1000 }}K
            </p>
          </div>

          <div v-if="bm.canEdit" class="flex items-center gap-0.5 shrink-0">
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-foreground transition-colors"
              :title="$t('common.edit')"
              @click="openBackendEdit(bm)"
            >
              <Pen class="size-3.5" />
            </button>
            <button
              class="size-7 flex items-center justify-center rounded text-muted-foreground hover:text-destructive transition-colors"
              :title="$t('common.delete')"
              @click="removeBackendModel(bm.id)"
            >
              <Trash2 class="size-3.5" />
            </button>
          </div>
          <Shield
            v-else
            class="size-3.5 text-muted-foreground/40 shrink-0"
            :title="$t('settings.modelConfig.backendModels.adminOnly')"
          />
        </div>
      </div>

      <Button
        v-if="auth.isAdmin"
        variant="outline"
        class="w-full cursor-pointer text-xs"
        @click="openBackendAdd"
      >
        <Plus class="size-3.5 mr-1" />
        {{ $t('settings.modelConfig.backendModels.addButton') }}
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
