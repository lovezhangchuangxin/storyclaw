<script setup lang="ts">
import { ref, onMounted, provide } from 'vue'
import { Toaster } from '@/components/ui/sonner'
import { getConfig } from '@/db/config'
import type { AppTheme } from '@/db/types'

const appTheme = ref<AppTheme>('light')

function applyTheme(theme: AppTheme) {
  const el = document.documentElement
  el.classList.remove('dark', 'parchment')
  if (theme === 'dark') el.classList.add('dark')
  if (theme === 'parchment') el.classList.add('parchment')
  try { localStorage.setItem('app-theme', theme) } catch { /* quota exceeded */ }
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
