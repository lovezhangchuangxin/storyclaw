<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Plus, Trash2, Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { getAllNovels, deleteNovel, createNovel } from '@/db/novels'
import type { Novel } from '@/db/types'
import { relativeTime } from '@/lib/time'
import { toast } from 'vue-sonner'

const COVER_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
]

function getCoverColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = ((hash << 5) - hash) + id.charCodeAt(i)
  }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length]
}

function statusLabel(status: string): string {
  if (status === 'completed') return '已完成'
  if (status === 'writing') return '创作中'
  if (status === 'paused') return '已暂停'
  return '草稿'
}

function statusBadgeClass(status: string): string {
  if (status === 'completed') {
    return 'bg-emerald-100 text-emerald-600 dark:bg-emerald-900/40 dark:text-emerald-400'
  }
  if (status === 'writing') {
    return 'bg-blue-100 text-blue-600 dark:bg-blue-900/40 dark:text-blue-300'
  }
  return 'bg-muted text-muted-foreground'
}

const router = useRouter()
const novels = ref<Novel[]>([])
const loading = ref(true)
const error = ref(false)
const searchQuery = ref('')

const filteredNovels = computed(() => {
  if (!searchQuery.value.trim()) return novels.value
  const q = searchQuery.value.toLowerCase()
  return novels.value.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.synopsis.toLowerCase().includes(q),
  )
})

onMounted(async () => {
  try {
    const all = await getAllNovels()
    novels.value = all.sort((a, b) => b.updatedAt - a.updatedAt)
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
})

function openStory(novel: Novel) {
  if (novel.status === 'drafting' && !novel.synopsis) {
    router.push(`/story/${novel.id}?tab=agent`)
  } else {
    router.push(`/story/${novel.id}`)
  }
}

async function startNewStory() {
  const id = crypto.randomUUID()
  await createNovel({
    id,
    title: '新故事',
    synopsis: '',
    genre: '',
    targetWordCount: 0,
    currentWordCount: 0,
    status: 'drafting',
    styleSettings: {
      narrativePerspective: '',
      tense: '',
      languageStyle: '',
    },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  })
  router.push(`/story/${id}?tab=agent`)
}

async function handleDelete(novel: Novel) {
  if (!window.confirm(`确定要删除《${novel.title || '未命名故事'}》吗？此操作不可撤销。`)) return
  try {
    await deleteNovel(novel.id)
    novels.value = novels.value.filter((n) => n.id !== novel.id)
  } catch (e) {
    toast.error('删除失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Loading State -->
    <template v-if="loading">
      <section class="rounded-xl border bg-card shadow-sm p-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div
            v-for="i in 4"
            :key="i"
            class="h-24 rounded-xl bg-muted animate-pulse"
          />
        </div>
      </section>
    </template>

    <!-- Error State -->
    <template v-else-if="error">
      <section class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center">
        <h3 class="text-sm font-medium mb-1">加载失败</h3>
        <p class="text-xs text-muted-foreground mb-4">请检查后重试</p>
        <button
          class="text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
          @click="router.go(0)"
        >
          重试
        </button>
      </section>
    </template>

    <!-- Loaded State -->
    <template v-else>
      <!-- Toolbar: search + create button -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchQuery"
            placeholder="搜索小说标题或简介..."
            class="pl-8"
          />
        </div>
        <Button
          v-if="novels.length > 0"
          size="sm"
          class="shrink-0 gap-1.5"
          @click="startNewStory"
        >
          <Plus class="size-4" />
          创建
        </Button>
      </div>

      <!-- Empty State (no novels at all) -->
      <template v-if="novels.length === 0">
        <section class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <BookOpen class="size-12 mb-4 text-muted-foreground/30" />
          <h3 class="text-sm font-medium mb-1">还没有故事</h3>
          <p class="text-xs text-muted-foreground mb-6">创建一个新故事，开始你的创作之旅</p>
          <Button @click="startNewStory">
            <Plus class="size-4" />
            开始第一个故事
          </Button>
        </section>
      </template>

      <!-- Empty search results -->
      <template v-else-if="filteredNovels.length === 0">
        <section class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <Search class="size-8 mb-3 text-muted-foreground/30" />
          <p class="text-sm text-muted-foreground">没有找到匹配的小说</p>
        </section>
      </template>

      <!-- Novel Grid -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="novel in filteredNovels"
          :key="novel.id"
          class="relative rounded-xl border bg-card text-left overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 group cursor-pointer"
          role="button"
          tabindex="0"
          @click="openStory(novel)"
          @keydown.enter="openStory(novel)"
        >
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="size-2 rounded-full shrink-0" :class="getCoverColor(novel.id)" />
                <h3 class="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors">
                  {{ novel.title || '未命名故事' }}
                </h3>
              </div>
              <button
                class="size-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                @click.stop="handleDelete(novel)"
                title="删除"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
            <p class="text-xs text-muted-foreground mt-1.5 line-clamp-2 leading-relaxed">
              {{ novel.synopsis || '暂无简介' }}
            </p>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-[11px] text-muted-foreground">{{ novel.currentWordCount }} 字</span>
              <span
                class="inline-flex items-center text-[10px] px-1.5 py-0.5 rounded-full font-medium"
                :class="statusBadgeClass(novel.status)"
              >
                {{ statusLabel(novel.status) }}
              </span>
            </div>
            <div class="mt-1 text-[11px] text-muted-foreground/60">
              {{ relativeTime(novel.updatedAt) }}
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
