import { getConfig } from '@/db/config'
import { useAuthStore } from '@/stores/auth'
import { useBackendModelsStore } from '@/stores/backendModels'
import type { ModelConfig } from '@/db/types'

/**
 * Get all available models (local + backend).
 * Backend models are included only when user is authenticated.
 */
export async function getAllModels(): Promise<ModelConfig[]> {
  const auth = useAuthStore()
  const config = await getConfig()
  const models: ModelConfig[] = [...config.models]

  // Add backend models if authenticated
  if (auth.isAuthenticated) {
    const backendModels = useBackendModelsStore()
    // Ensure backend models are loaded
    if (backendModels.models.length === 0 && !backendModels.loading) {
      await backendModels.fetchModels().catch(() => {
        // Ignore fetch errors, backend might be unavailable
      })
    }
    // Convert backend models to ModelConfig format
    for (const bm of backendModels.models) {
      models.push(backendModels.toModelConfig(bm))
    }
  }

  return models
}
