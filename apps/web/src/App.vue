<script setup lang="ts">
import { ref, onMounted, provide } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import { getConfig, saveConfig } from '@/db/config'
import type { AppTheme } from '@/db/types'

const appTheme = ref<AppTheme>('light')

const THEME_CLASSES: AppTheme[] = ['dark', 'parchment', 'frost', 'peach', 'pine']

async function applyTheme(theme: AppTheme) {
  appTheme.value = theme
  const el = document.documentElement
  el.classList.remove(...THEME_CLASSES)
  if (theme !== 'light') {
    el.classList.add(theme)
  }
  try {
    localStorage.setItem('app-theme', theme)
  } catch {
    /* quota exceeded */
  }
  try {
    const config = await getConfig()
    config.appTheme = theme
    await saveConfig(config)
  } catch {
    /* ignore */
  }
}

onMounted(async () => {
  try {
    const config = await getConfig()
    appTheme.value = config.appTheme
    applyTheme(config.appTheme)
  } catch {
    console.error('Failed to load app config, using default theme')
  }
})

provide('appTheme', appTheme)
provide('applyTheme', applyTheme)
</script>

<template>
  <router-view />
  <Toaster position="top-center" :duration="3000" richColors class="z-[9999]" />
</template>
