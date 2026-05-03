<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { BookOpen, MessageSquareText, User, Settings, Server, Palette, PanelLeftClose, PanelLeft } from 'lucide-vue-next'

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

const items = [
  { path: '/', label: '书架', icon: BookOpen },
  { path: '/prompts', label: '提示词', icon: MessageSquareText },
  { path: '/settings/model', label: '模型配置', icon: Settings },
  { path: '/settings/server', label: '后端连接', icon: Server },
  { path: '/settings/reading', label: '阅读偏好', icon: Palette },
  { path: '/my', label: '我的', icon: User },
]

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
      >StoryClaw</span>
      <button
        v-if="variant === 'desktop'"
        :aria-label="collapsed ? '展开侧边栏' : '折叠侧边栏'"
        class="size-7 flex items-center justify-center rounded-md hover:bg-muted shrink-0"
        @click="emit('toggle')"
      >
        <PanelLeftClose v-if="!collapsed" class="size-5 text-muted-foreground" aria-hidden="true" />
        <PanelLeft v-else class="size-5 text-muted-foreground" aria-hidden="true" />
      </button>
    </div>

    <!-- Nav items -->
    <nav aria-label="主导航" class="flex-1 py-2 px-2">
      <button
        v-for="item in items"
        :key="item.path"
        class="flex items-center w-full rounded-md text-sm transition-colors px-3 py-2"
        :class="isActive(item.path)
          ? 'bg-primary/10 text-primary font-medium'
          : 'text-muted-foreground hover:bg-muted hover:text-foreground'"
        :title="collapsed && variant === 'desktop' ? item.label : ''"
        @click="navigate(item.path)"
      >
        <component :is="item.icon" class="size-5 shrink-0" />
        <span
          v-show="!(collapsed && variant === 'desktop')"
          class="ml-3 truncate"
        >{{ item.label }}</span>
      </button>
    </nav>
  </aside>
</template>
