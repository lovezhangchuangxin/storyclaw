<script setup lang="ts">
import { useRouter, useRoute } from 'vue-router'
import { BookOpen, Pen, User, PanelLeftClose, PanelLeft } from 'lucide-vue-next'

const props = defineProps<{
  collapsed: boolean
  variant: 'desktop' | 'mobile'
}>()

const emit = defineEmits<{
  toggle: []
  navigate: []
}>()

const CREATE_PATH = '__create__'

const router = useRouter()
const route = useRoute()

const items = [
  { path: '/', label: '书架', icon: BookOpen },
  { path: CREATE_PATH, label: '创作', icon: Pen },
  { path: '/my', label: '我的', icon: User },
]

function isActive(path: string) {
  if (path === '/') return route.path === '/'
  if (path === CREATE_PATH) return route.path.startsWith('/story')
  return route.path.startsWith(path)
}

function navigate(path: string) {
  if (path === CREATE_PATH) {
    router.push(`/story/${crypto.randomUUID()}?new=true`)
  } else {
    router.push(path)
  }
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
