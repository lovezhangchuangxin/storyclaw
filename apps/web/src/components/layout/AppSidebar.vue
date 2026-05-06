<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import {
  BookOpen,
  MessageSquareText,
  User,
  Settings,
  Server,
  Palette,
  PanelLeftClose,
  PanelLeft,
  Shield,
} from 'lucide-vue-next'
import { useAuthStore } from '@/stores/auth'
import { computed } from 'vue'

const props = defineProps<{
  collapsed: boolean
  variant: 'desktop' | 'mobile'
}>()

const emit = defineEmits<{
  toggle: []
  navigate: []
}>()

const router = useRouter()
const route = useRoute()
const auth = useAuthStore()

const items = [
  { path: '/', label: 'sidebar.bookshelf', icon: BookOpen },
  { path: '/prompts', label: 'sidebar.prompts', icon: MessageSquareText },
  { path: '/settings/model', label: 'sidebar.modelConfig', icon: Settings },
  { path: '/settings/server', label: 'sidebar.serverConnection', icon: Server },
  { path: '/settings/appearance', label: 'sidebar.appearance', icon: Palette },
  { path: '/my', label: 'sidebar.my', icon: User },
]

const adminItem = { path: '/admin', label: 'sidebar.admin', icon: Shield }

const appVersion = __APP_VERSION__

const visibleItems = computed(() => {
  if (auth.isAdmin) {
    return [...items, adminItem]
  }
  return items
})

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  return route.path === path || route.path.startsWith(path + '/')
}

function navigate(path: string) {
  router.push(path)
  emit('navigate')
}
</script>

<template>
  <aside
    class="flex flex-col h-full border-r"
    :class="variant === 'mobile' ? 'bg-background' : 'bg-muted/20'"
  >
    <!-- Header -->
    <div
      class="flex items-center h-12 shrink-0 border-b px-3"
      :class="collapsed && variant === 'desktop' ? 'justify-center' : ''"
    >
      <span
        v-show="!(collapsed && variant === 'desktop')"
        class="font-semibold text-sm flex-1 truncate"
        >StoryClaw</span
      >
      <button
        v-if="variant === 'desktop'"
        :aria-label="collapsed ? $t('sidebar.expandSidebar') : $t('sidebar.collapseSidebar')"
        class="size-7 flex items-center justify-center rounded-md hover:bg-muted shrink-0"
        @click="emit('toggle')"
      >
        <PanelLeftClose v-if="!collapsed" class="size-5 text-muted-foreground" aria-hidden="true" />
        <PanelLeft v-else class="size-5 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>

    <!-- Nav items -->
    <nav :aria-label="$t('sidebar.mainNav')" class="flex-1 py-2 px-2">
      <button
        v-for="item in visibleItems"
        :key="item.path"
        class="flex items-center w-full rounded-md text-sm transition-colors px-3 py-2"
        :class="
          isActive(item.path)
            ? 'bg-primary/10 text-primary font-medium'
            : 'text-muted-foreground hover:bg-muted hover:text-foreground'
        "
        :title="collapsed && variant === 'desktop' ? $t(item.label) : ''"
        @click="navigate(item.path)"
      >
        <component :is="item.icon" class="size-5 shrink-0" />
        <span v-show="!(collapsed && variant === 'desktop')" class="ml-3 truncate">{{
          $t(item.label)
        }}</span>
      </button>
    </nav>

    <!-- Footer -->
    <div v-show="!(collapsed && variant === 'desktop')" class="shrink-0 px-4 pb-3 pt-1">
      <p class="text-xs text-muted-foreground">{{ $t('sidebar.version') }} {{ appVersion }}</p>
    </div>
  </aside>
</template>
