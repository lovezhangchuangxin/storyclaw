<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Settings, Server, Palette, ChevronRight } from 'lucide-vue-next'

const router = useRouter()

const menuItems = [
  {
    icon: Settings,
    label: '模型配置',
    description: '配置 AI 模型 API 和参数',
    path: '/settings/model',
  },
  {
    icon: Server,
    label: '后端连接',
    description: '连接后端服务以同步数据',
    path: '/settings/server',
  },
  {
    icon: Palette,
    label: '阅读偏好',
    description: '字体、字号、主题、翻页模式',
    path: '/settings/reading',
  },
]
</script>

<template>
  <div class="p-4">
    <div class="rounded-lg border divide-y">
      <button
        v-for="item in menuItems"
        :key="item.label"
        class="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-muted/50"
        @click="router.push(item.path)"
      >
        <component :is="item.icon" class="size-5 text-muted-foreground" />
        <div class="flex-1 min-w-0">
          <p class="text-sm font-medium">{{ item.label }}</p>
          <p class="text-xs text-muted-foreground">{{ item.description }}</p>
        </div>
        <ChevronRight class="size-4 text-muted-foreground" />
      </button>
    </div>
  </div>
</template>
