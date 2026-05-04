import { ref } from 'vue'
import { defineStore } from 'pinia'
import type { BackendModelConfig } from '@/db/types'
import {
  listBackendModels,
  createBackendModel as apiCreate,
  updateBackendModel as apiUpdate,
  deleteBackendModel as apiDelete,
} from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'

export const useBackendModelsStore = defineStore('backendModels', () => {
  const models = ref<BackendModelConfig[]>([])
  const loading = ref(false)
  const error = ref<string | null>(null)

  async function fetchModels() {
    const auth = useAuthStore()
    if (!auth.isAuthenticated) return

    loading.value = true
    error.value = null
    try {
      models.value = await listBackendModels()
    } catch (e) {
      error.value = e instanceof Error ? e.message : 'Failed to load models'
    } finally {
      loading.value = false
    }
  }

  function toModelConfig(bm: BackendModelConfig) {
    return {
      id: `backend-${bm.id}`,
      provider: bm.provider,
      apiBase: '',
      apiKey: '',
      model: bm.model,
      maxOutputTokens: bm.maxOutputTokens,
      contextWindowTokens: bm.contextWindowTokens,
      isBackendModel: true,
      backendId: bm.id,
      backendName: bm.name,
    }
  }

  async function create(modelData: Parameters<typeof apiCreate>[0]) {
    const created = await apiCreate(modelData)
    models.value.push(created)
    return created
  }

  async function update(id: string, modelData: Parameters<typeof apiUpdate>[1]) {
    const updated = await apiUpdate(id, modelData)
    const idx = models.value.findIndex((m) => m.id === id)
    if (idx !== -1) models.value[idx] = updated
    return updated
  }

  async function remove(id: string) {
    await apiDelete(id)
    models.value = models.value.filter((m) => m.id !== id)
  }

  return {
    models,
    loading,
    error,
    fetchModels,
    toModelConfig,
    create,
    update,
    remove,
  }
})
