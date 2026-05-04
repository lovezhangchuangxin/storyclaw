<script setup lang="ts">
import { ref, watch, computed, provide, shallowRef, onMounted, onBeforeUnmount } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { Menu, ArrowLeft, Cloud } from 'lucide-vue-next'
import type { Component } from 'vue'
import AppSidebar from './AppSidebar.vue'
import { useBackgroundImage } from '@/composables/useBackgroundImage'
import { useAuthStore } from '@/stores/auth'

const route = useRoute()
const router = useRouter()
const auth = useAuthStore()
const collapsed = ref(loadCollapsed())
const mobileOpen = ref(false)

const syncClass = computed(() => {
  if (!auth.isAuthenticated) return 'text-muted-foreground/40'
  return 'text-emerald-500 dark:text-emerald-400'
})

const { backgroundUrl, bgOpacity, bgBlur, loadAll, cleanup } = useBackgroundImage()

onMounted(() => {
  loadAll()
})

onBeforeUnmount(() => {
  cleanup()
})

const title = ref((route.meta.title as string) ?? '')

watch(() => route.meta.title, (t) => {
  title.value = (t as string) ?? ''
}, { immediate: true })

provide('setTitle', (t: string | null) => {
  title.value = t ?? (route.meta.title as string) ?? ''
})
const showBack = computed(() => !!route.meta.back)

const topbarExtra = shallowRef<Component | null>(null)
provide('setTopbarExtra', (c: Component | null) => { topbarExtra.value = c })

function loadCollapsed(): boolean {
  try {
    return localStorage.getItem('storyclaw:sidebar-collapsed') === 'true'
  } catch {
    return false
  }
}

watch(collapsed, (v) => {
  try {
    localStorage.setItem('storyclaw:sidebar-collapsed', String(v))
  } catch {}
})

function toggleCollapsed() {
  collapsed.value = !collapsed.value
}

function closeMobile() {
  mobileOpen.value = false
}
</script>

<template>
  <div class="flex h-dvh bg-background">
    <!-- Background image layer -->
    <div
      v-if="backgroundUrl"
      class="fixed inset-0 z-0 bg-cover bg-center bg-no-repeat"
      :style="{
        backgroundImage: `url(${backgroundUrl})`,
        opacity: bgOpacity / 100,
        filter: bgBlur > 0 ? `blur(${bgBlur}px)` : undefined,
      }"
    />

    <!-- Main content above background -->
    <div class="relative z-10 flex w-full">
      <!-- Mobile overlay sidebar -->
      <Transition name="mobile-overlay">
        <div v-if="mobileOpen" class="md:hidden fixed inset-0 z-50">
          <div class="absolute inset-0 bg-black/40" @click="closeMobile" />
          <div class="absolute inset-y-0 left-0 w-60 shadow-xl">
            <AppSidebar
              variant="mobile"
              :collapsed="false"
              @navigate="closeMobile"
            />
          </div>
        </div>
      </Transition>

      <!-- Desktop sidebar -->
      <div
        class="hidden md:block shrink-0 overflow-hidden transition-all duration-300 ease-in-out"
        :class="collapsed ? 'w-[60px]' : 'w-[216px]'"
      >
        <AppSidebar
          variant="desktop"
          :collapsed="collapsed"
          @toggle="toggleCollapsed"
        />
      </div>

      <!-- Content -->
      <div class="flex-1 flex flex-col min-w-0">
        <!-- Top bar -->
        <header class="flex items-center h-12 shrink-0 border-b px-3 gap-3 bg-background/90 backdrop-blur-sm">
          <button
            aria-label="打开导航菜单"
            class="size-8 flex items-center justify-center rounded-md hover:bg-muted md:hidden"
            @click="mobileOpen = true"
          >
            <Menu class="size-5" aria-hidden="true" />
          </button>
          <button
            v-if="showBack"
            aria-label="返回"
            class="size-8 flex items-center justify-center rounded-md hover:bg-muted"
            @click="router.back()"
          >
            <ArrowLeft class="size-5" aria-hidden="true" />
          </button>
          <h1 class="text-sm font-semibold truncate">{{ title }}</h1>
          <div class="flex-1" />
          <Cloud
            class="size-4 shrink-0 hidden sm:block"
            :class="syncClass"
            :title="auth.isAuthenticated ? '已连接后端' : '未连接后端'"
          />
          <component :is="topbarExtra" v-if="topbarExtra" />
        </header>

        <!-- Page content -->
        <main class="flex-1 overflow-auto overscroll-none">
          <router-view />
        </main>
      </div>
    </div>
  </div>
</template>

<style scoped>
.mobile-overlay-enter-active,
.mobile-overlay-leave-active {
  transition: opacity 0.25s ease;
}
.mobile-overlay-enter-active > :last-child,
.mobile-overlay-leave-active > :last-child {
  transition: transform 0.25s ease;
}
.mobile-overlay-enter-from,
.mobile-overlay-leave-to {
  opacity: 0;
}
.mobile-overlay-enter-from > :last-child {
  transform: translateX(-100%);
}
.mobile-overlay-leave-to > :last-child {
  transform: translateX(-100%);
}
</style>
