import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getConfig, saveConfig } from '@/db/config'
import { type SupportedLocale, setLocale } from '@/i18n'
import { clearToolRegistryCache } from '@/agent/tools'

export const useLocaleStore = defineStore('locale', () => {
  const locale = ref<SupportedLocale>('zh-CN')

  async function initialize() {
    try {
      const config = await getConfig()
      if (config.locale) {
        locale.value = config.locale
        setLocale(config.locale)
      }
    } catch {}
  }

  async function switchLocale(target: SupportedLocale) {
    locale.value = target
    setLocale(target)
    clearToolRegistryCache()
    try {
      const config = await getConfig()
      config.locale = target
      await saveConfig(config)
    } catch {}
  }

  return {
    locale,
    initialize,
    switchLocale,
  }
})
