<script setup lang="ts">
import { useRouter } from 'vue-router'
import { Settings, Server, Palette, ChevronRight, BookOpen } from 'lucide-vue-next'

const router = useRouter()

const menuItems = [
  {
    icon: Settings,
    label: '模型配置',
    description: '配置 AI 模型 API 和参数',
    path: '/settings/model',
    color: 'bg-primary/10 text-primary dark:bg-primary/20 dark:text-primary',
  },
  {
    icon: Server,
    label: '后端连接',
    description: '连接后端服务以同步数据',
    path: '/settings/server',
    color: 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400',
  },
  {
    icon: Palette,
    label: '阅读偏好',
    description: '字体、字号、主题、翻页模式',
    path: '/settings/reading',
    color: 'bg-amber-100 text-amber-600 dark:bg-amber-900/40 dark:text-amber-400',
  },
]
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

    <!-- App Info Card -->
    <section class="rounded-xl border bg-card shadow-sm p-5">
      <div class="flex items-center gap-4">
        <div class="size-11 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
          <BookOpen class="size-5 text-primary/40" />
        </div>
        <div>
          <p class="text-sm font-semibold">StoryClaw</p>
          <p class="text-xs text-muted-foreground">本地模式 · 数据存储在浏览器中</p>
        </div>
      </div>
    </section>

    <!-- Navigation Section Card -->
    <section class="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div class="divide-y">
        <button
          v-for="item in menuItems"
          :key="item.label"
          class="flex w-full items-center gap-4 px-4 py-4 text-left transition-all duration-200 hover:bg-muted/30"
          @click="router.push(item.path)"
        >
          <div
            class="size-10 rounded-xl flex items-center justify-center shrink-0"
            :class="item.color"
          >
            <component :is="item.icon" class="size-5" />
          </div>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-medium">{{ item.label }}</p>
            <p class="text-xs text-muted-foreground mt-0.5">{{ item.description }}</p>
          </div>
          <ChevronRight class="size-4 text-muted-foreground shrink-0" />
        </button>
      </div>
    </section>

  </div>
</template>
