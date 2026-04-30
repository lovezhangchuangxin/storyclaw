<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { BookOpen, Pen, User } from 'lucide-vue-next'
import { cn } from '@/lib/utils'

const router = useRouter()
const route = useRoute()

const tabs = [
  { path: '/', name: 'home', label: '书架', icon: BookOpen },
  { path: '/create', name: 'create', label: '创建', icon: Pen },
  { path: '/my', name: 'my', label: '我的', icon: User },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path.startsWith(path)
}

function navigate(path: string) {
  router.push(path)
}
</script>

<template>
  <div class="flex flex-col h-dvh">
    <main class="flex-1 overflow-auto">
      <router-view />
    </main>

    <nav class="flex items-center justify-around border-t bg-background shrink-0 pb-safe">
      <button
        v-for="tab in tabs"
        :key="tab.name"
        class="flex flex-col items-center gap-0.5 py-2 px-4 text-xs transition-colors"
        :class="
          cn(isActive(tab.path) ? 'text-primary' : 'text-muted-foreground hover:text-foreground')
        "
        @click="navigate(tab.path)"
      >
        <component :is="tab.icon" class="size-5" />
        <span>{{ tab.label }}</span>
      </button>
    </nav>
  </div>
</template>
