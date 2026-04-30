<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Plus } from 'lucide-vue-next'
import { getAllNovels } from '@/db/novels'
import type { Novel } from '@/db/types'

const router = useRouter()
const novels = ref<Novel[]>([])
const loading = ref(true)

onMounted(async () => {
  novels.value = await getAllNovels()
  loading.value = false
})

function openStory(id: string) {
  router.push(`/story/${id}`)
}
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-bold mb-4">书架</h1>

    <!-- Loading -->
    <div v-if="loading" class="grid grid-cols-2 gap-3">
      <div v-for="i in 4" :key="i" class="aspect-[3/4] rounded-lg bg-muted animate-pulse" />
    </div>

    <!-- Empty -->
    <div
      v-else-if="novels.length === 0"
      class="flex flex-col items-center justify-center py-20 text-muted-foreground"
    >
      <BookOpen class="size-16 mb-4 opacity-30" />
      <p class="text-sm mb-4">还没有故事</p>
      <button
        class="inline-flex items-center gap-1.5 rounded-lg bg-primary px-4 py-2 text-sm text-primary-foreground"
        @click="router.push('/create')"
      >
        <Plus class="size-4" />
        开始你的第一个故事
      </button>
    </div>

    <!-- Grid -->
    <div v-else class="grid grid-cols-2 gap-3">
      <button
        v-for="novel in novels"
        :key="novel.id"
        class="aspect-[3/4] rounded-lg border bg-card p-3 text-left transition-colors hover:border-primary/50"
        @click="openStory(novel.id)"
      >
        <div class="flex flex-col h-full">
          <h3 class="font-medium text-sm line-clamp-2">{{ novel.title || '未命名故事' }}</h3>
          <p class="text-xs text-muted-foreground mt-1 line-clamp-2">
            {{ novel.synopsis || '暂无简介' }}
          </p>
          <div class="mt-auto pt-2 flex items-center justify-between text-xs text-muted-foreground">
            <span>{{ novel.currentWordCount }}字</span>
            <span>{{
              novel.status === 'completed'
                ? '已完成'
                : novel.status === 'writing'
                  ? '创作中'
                  : '草稿'
            }}</span>
          </div>
        </div>
      </button>
    </div>
  </div>
</template>
