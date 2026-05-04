import { ref, computed } from 'vue'
import { getAllNovels, getNovelById, updateNovelFromSync } from '@/db/novels'
import { getOutlineByNovelId } from '@/db/outlines'
import { getCharactersByNovelId } from '@/db/characters'
import { getChaptersByNovelId } from '@/db/chapters'
import { getWorldBuildingByNovelId } from '@/db/worldBuilding'
import { getConversationByNovelId } from '@/db/conversations'
import {
  pushNovel as apiPushNovel,
  pullNovel as apiPullNovel,
} from '@/lib/api-client'
import { useAuthStore } from '@/stores/auth'
import type { SyncPayload } from '@/db/types'

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'error' | 'offline'

const syncStatusMap = ref<Record<string, SyncStatus>>({})
const lastSyncMap = ref<Record<string, number>>({})
const isSyncing = ref(false)

export function useSync() {
  const auth = useAuthStore()

  const isOnline = computed(() => auth.isAuthenticated)

  function getSyncStatus(novelId: string): SyncStatus {
    return isOnline.value ? (syncStatusMap.value[novelId] ?? 'idle') : 'offline'
  }

  function getLastSync(novelId: string): number | null {
    return lastSyncMap.value[novelId] ?? null
  }

  async function buildSyncPayload(novelId: string): Promise<SyncPayload> {
    const novel = await getNovelById(novelId)
    const outline = await getOutlineByNovelId(novelId).catch(() => undefined)
    const characters = await getCharactersByNovelId(novelId)
    const chapters = await getChaptersByNovelId(novelId)
    const worldBuilding = await getWorldBuildingByNovelId(novelId).catch(() => undefined)
    const conversation = await getConversationByNovelId(novelId).catch(() => undefined)

    return {
      novel: novel!,
      outline,
      characters,
      chapters,
      worldBuilding,
      conversation,
    }
  }

  async function pushNovel(novelId: string): Promise<boolean> {
    if (!isOnline.value) return false

    syncStatusMap.value[novelId] = 'syncing'
    try {
      const novel = await getNovelById(novelId)
      if (!novel) return false

      const backendId = novel.backendId ?? novelId
      const payload = await buildSyncPayload(novelId)
      const resp = await apiPushNovel(backendId, payload, novel.version ?? 0)

      if (resp.accepted) {
        syncStatusMap.value[novelId] = 'synced'
        lastSyncMap.value[novelId] = Date.now()
        const updatedNovel = { ...novel, version: resp.serverVersion }
        if (resp.backendId) {
          updatedNovel.backendId = resp.backendId
        }
        await updateNovelFromSync(updatedNovel)
        return true
      } else {
        syncStatusMap.value[novelId] = 'error'
        return false
      }
    } catch {
      syncStatusMap.value[novelId] = 'error'
      return false
    }
  }

  async function pullNovel(novelId: string): Promise<boolean> {
    if (!isOnline.value) return false

    syncStatusMap.value[novelId] = 'syncing'
    try {
      const novel = await getNovelById(novelId)
      if (!novel) return false

      const backendId = novel.backendId ?? novelId
      const resp = await apiPullNovel(backendId)

      if (resp.version > (novel.version ?? 0)) {
        await updateNovelFromSync({ ...resp.data.novel, version: resp.version, backendId })
        const { saveOutline } = await import('@/db/outlines')
        const { saveChapter } = await import('@/db/chapters')
        const { saveWorldBuilding } = await import('@/db/worldBuilding')

        if (resp.data.outline) await saveOutline({ ...resp.data.outline, novelId })
        for (const ch of resp.data.characters) {
          const { saveCharacter } = await import('@/db/characters')
          await saveCharacter({ ...ch, novelId })
        }
        for (const ch of resp.data.chapters) {
          await saveChapter({ ...ch, novelId })
        }
        if (resp.data.worldBuilding) await saveWorldBuilding({ ...resp.data.worldBuilding, novelId })

        syncStatusMap.value[novelId] = 'synced'
        lastSyncMap.value[novelId] = Date.now()
        return true
      }

      syncStatusMap.value[novelId] = 'synced'
      return false
    } catch {
      syncStatusMap.value[novelId] = 'error'
      return false
    }
  }

  async function pushAllNovels(): Promise<number> {
    if (!isOnline.value) return 0
    isSyncing.value = true
    let count = 0
    try {
      const novels = await getAllNovels()
      for (const novel of novels) {
        const ok = await pushNovel(novel.id)
        if (ok) count++
      }
    } finally {
      isSyncing.value = false
    }
    return count
  }

  return {
    syncStatusMap,
    isSyncing,
    isOnline,
    getSyncStatus,
    getLastSync,
    pushNovel,
    pullNovel,
    pushAllNovels,
    buildSyncPayload,
  }
}
