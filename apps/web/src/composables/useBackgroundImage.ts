import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { getConfig, saveConfig } from '@/db/config'
import {
  listBackgroundImages,
  getBackgroundImage,
  saveBackgroundImage,
  deleteBackgroundImage,
} from '@/db/assets'
import type { BackgroundImage, BackgroundSettings } from '@/db/types'

export interface BackgroundImageMeta {
  id: string
  name: string
  type: string
  thumbnailUrl: string
  updatedAt: number
}

const MAX_FILE_SIZE = 10 * 1024 * 1024
const ALLOWED_IMAGE_TYPES = ['image/jpeg', 'image/png', 'image/webp']

// Module-level singleton state: all callers share the same background image state.
const backgroundUrl = ref<string | null>(null)
const bgOpacity = ref(30)
const bgBlur = ref(0)
const images = ref<BackgroundImageMeta[]>([])
const activeImageId = ref<string | null>(null)
const loaded = ref(false)

let activeObjectUrl: string | null = null
const thumbnailUrls = new Map<string, string>()
const blobCache = new Map<string, Blob>()
let loadPromise: Promise<void> | null = null

function revokeActiveUrl() {
  if (activeObjectUrl) {
    URL.revokeObjectURL(activeObjectUrl)
    activeObjectUrl = null
  }
}

function revokeThumbnailUrl(id: string) {
  const url = thumbnailUrls.get(id)
  if (url) {
    URL.revokeObjectURL(url)
    thumbnailUrls.delete(id)
  }
}

function revokeAllThumbnailUrls() {
  for (const url of thumbnailUrls.values()) {
    URL.revokeObjectURL(url)
  }
  thumbnailUrls.clear()
}

export function useBackgroundImage() {
  const { t } = useI18n()

  async function loadAll() {
    if (loadPromise) return loadPromise
    loadPromise = (async () => {
      try {
        const config = await getConfig()
        activeImageId.value = config.backgroundSettings?.activeImageId ?? null
        bgOpacity.value = config.backgroundSettings?.opacity ?? 30
        bgBlur.value = config.backgroundSettings?.blur ?? 0

        const allImages = await listBackgroundImages()
        revokeAllThumbnailUrls()
        blobCache.clear()

        images.value = allImages.map((img) => {
          const thumbnailUrl = URL.createObjectURL(img.blob)
          thumbnailUrls.set(img.id, thumbnailUrl)
          blobCache.set(img.id, img.blob)
          return {
            id: img.id,
            name: img.name,
            type: img.type,
            thumbnailUrl,
            updatedAt: img.updatedAt,
          }
        })

        if (activeImageId.value) {
          const activeBlob = blobCache.get(activeImageId.value)
          if (activeBlob) {
            revokeActiveUrl()
            activeObjectUrl = URL.createObjectURL(activeBlob)
            backgroundUrl.value = activeObjectUrl
          } else {
            backgroundUrl.value = null
            activeImageId.value = null
          }
        } else {
          revokeActiveUrl()
          backgroundUrl.value = null
        }

        loaded.value = true
      } catch (e) {
        toast.error(t('error.loadBackgroundFailed'), {
          description: e instanceof Error ? e.message : String(e),
        })
      } finally {
        loadPromise = null
      }
    })()
    return loadPromise
  }

  async function uploadImage(file: File): Promise<void> {
    if (!ALLOWED_IMAGE_TYPES.includes(file.type)) {
      toast.error(t('error.fileTypeUnsupported'))
      return
    }
    if (file.size > MAX_FILE_SIZE) {
      toast.error(t('error.fileSizeExceeded'))
      return
    }

    const id = crypto.randomUUID()
    const now = Date.now()

    const img: BackgroundImage = {
      id,
      blob: file,
      type: file.type,
      name: file.name,
      updatedAt: now,
    }

    await saveBackgroundImage(img)
    blobCache.set(id, file)

    const thumbnailUrl = URL.createObjectURL(file)
    thumbnailUrls.set(id, thumbnailUrl)

    images.value.push({
      id,
      name: file.name,
      type: file.type,
      thumbnailUrl,
      updatedAt: now,
    })

    try {
      await selectImage(id)
    } catch {
      toast.error(t('common.saveFailed'))
    }
  }

  async function selectImage(id: string): Promise<void> {
    const blob = blobCache.get(id) ?? (await getBackgroundImage(id))?.blob
    if (!blob) return

    revokeActiveUrl()
    activeObjectUrl = URL.createObjectURL(blob)
    backgroundUrl.value = activeObjectUrl
    activeImageId.value = id

    const config = await getConfig()
    config.backgroundSettings = {
      ...config.backgroundSettings,
      activeImageId: id,
    }
    await saveConfig(config)
  }

  async function removeImage(id: string): Promise<void> {
    await deleteBackgroundImage(id)
    revokeThumbnailUrl(id)
    blobCache.delete(id)

    images.value = images.value.filter((img) => img.id !== id)

    if (activeImageId.value === id) {
      await deselectImage()
    }
  }

  async function deselectImage(): Promise<void> {
    revokeActiveUrl()
    backgroundUrl.value = null
    activeImageId.value = null

    const config = await getConfig()
    config.backgroundSettings = {
      ...config.backgroundSettings,
      activeImageId: null,
    }
    await saveConfig(config)
  }

  let settingsTimer: ReturnType<typeof setTimeout> | null = null

  function updateSettingsDebounced(settings: Partial<BackgroundSettings>) {
    if (settings.opacity !== undefined) bgOpacity.value = settings.opacity
    if (settings.blur !== undefined) bgBlur.value = settings.blur

    if (settingsTimer) clearTimeout(settingsTimer)
    settingsTimer = setTimeout(async () => {
      try {
        const config = await getConfig()
        config.backgroundSettings = {
          ...config.backgroundSettings,
          ...settings,
        }
        await saveConfig(config)
      } catch (e) {
        toast.error(t('common.saveFailed'), {
          description: e instanceof Error ? e.message : String(e),
        })
      }
    }, 300)
  }

  function cleanup() {
    revokeActiveUrl()
    revokeAllThumbnailUrls()
    blobCache.clear()
    backgroundUrl.value = null
    images.value = []
    activeImageId.value = null
    bgOpacity.value = 30
    bgBlur.value = 0
    loaded.value = false
  }

  return {
    backgroundUrl,
    bgOpacity,
    bgBlur,
    images,
    activeImageId,
    loaded,
    loadAll,
    uploadImage,
    selectImage,
    deselectImage,
    removeImage,
    updateSettingsDebounced,
    cleanup,
  }
}
