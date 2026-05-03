<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Plus, Trash2, Search, ArrowUp, ArrowDown, GripVertical, ChevronDown, X } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { getAllNovels, deleteNovel, createNovel } from '@/db/novels'
import { getAllPrompts } from '@/db/prompts'
import type { Novel, Prompt } from '@/db/types'
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
const deleteDialogOpen = ref(false)
const novelToDelete = ref<Novel | null>(null)

const newStoryDialogOpen = ref(false)
const allPrompts = ref<Prompt[]>([])
const selectedPromptIds = ref<string[]>(['builtin-persona'])
const promptSearch = ref('')
const promptPopoverOpen = ref(false)

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

const filteredNovels = computed(() => {
  if (!searchQuery.value.trim()) return novels.value
  const q = searchQuery.value.toLowerCase()
  return novels.value.filter(
    (n) =>
      n.title.toLowerCase().includes(q) ||
      n.synopsis.toLowerCase().includes(q),
  )
})

const selectedPrompts = computed(() => {
  const orderMap = new Map(selectedPromptIds.value.map((id, i) => [id, i]))
  return allPrompts.value
    .filter((p) => selectedPromptIds.value.includes(p.id))
    .sort((a, b) => (orderMap.get(a.id) ?? 0) - (orderMap.get(b.id) ?? 0))
})

const availablePrompts = computed(() => {
  const q = promptSearch.value.toLowerCase()
  return allPrompts.value.filter(
    (p) =>
      !selectedPromptIds.value.includes(p.id) &&
      (!q || p.name.toLowerCase().includes(q)),
  )
})

function selectPrompt(id: string) {
  if (!selectedPromptIds.value.includes(id)) {
    selectedPromptIds.value = [...selectedPromptIds.value, id]
  }
  promptSearch.value = ''
  promptPopoverOpen.value = false
}

function removePrompt(id: string) {
  const prompt = allPrompts.value.find((p) => p.id === id)
  if (prompt?.isBuiltin) return
  selectedPromptIds.value = selectedPromptIds.value.filter((pid) => pid !== id)
}

const dragIndex = ref<number | null>(null)
const dragOverIndex = ref<number | null>(null)
const dragTarget = ref<HTMLElement | null>(null)
const dragPointerId = ref<number | null>(null)

function onPointerDown(e: PointerEvent, idx: number) {
  const grip = e.currentTarget as HTMLElement
  grip.setPointerCapture(e.pointerId)
  dragTarget.value = grip
  dragIndex.value = idx
  dragPointerId.value = e.pointerId
}

function onPointerMove(e: PointerEvent) {
  if (dragIndex.value === null) return
  const listEl = (e.currentTarget as HTMLElement).closest('[data-sortable-list]')
  if (!listEl) return
  const items = listEl.querySelectorAll('[data-sortable-item]')
  let closest = dragIndex.value
  let minDist = Infinity
  items.forEach((el, i) => {
    const rect = el.getBoundingClientRect()
    const midY = rect.top + rect.height / 2
    const dist = Math.abs(e.clientY - midY)
    if (dist < minDist) {
      minDist = dist
      closest = i
    }
  })
  dragOverIndex.value = closest
}

function onPointerUp() {
  if (dragIndex.value === null) return
  if (dragOverIndex.value !== null && dragOverIndex.value !== dragIndex.value) {
    const arr = [...selectedPromptIds.value]
    const [moved] = arr.splice(dragIndex.value, 1)
    arr.splice(dragOverIndex.value, 0, moved)
    selectedPromptIds.value = arr
  }
  if (dragTarget.value && dragPointerId.value !== null) {
    dragTarget.value.releasePointerCapture(dragPointerId.value)
  }
  dragIndex.value = null
  dragOverIndex.value = null
  dragTarget.value = null
  dragPointerId.value = null
}

function onPointerCancel() {
  dragIndex.value = null
  dragOverIndex.value = null
  dragTarget.value = null
  dragPointerId.value = null
}

function movePromptUp(id: string) {
  const idx = selectedPromptIds.value.indexOf(id)
  if (idx <= 0) return
  const arr = [...selectedPromptIds.value]
  ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
  selectedPromptIds.value = arr
}

function movePromptDown(id: string) {
  const idx = selectedPromptIds.value.indexOf(id)
  if (idx === -1 || idx >= selectedPromptIds.value.length - 1) return
  const arr = [...selectedPromptIds.value]
  ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
  selectedPromptIds.value = arr
}

function openNewStoryDialog() {
  selectedPromptIds.value = ['builtin-persona']
  promptSearch.value = ''
  promptPopoverOpen.value = false
  getAllPrompts().then((ps) => {
    allPrompts.value = ps
  })
  newStoryDialogOpen.value = true
}

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
    selectedPromptIds: [...selectedPromptIds.value],
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  })
  newStoryDialogOpen.value = false
  router.push(`/story/${id}?tab=agent`)
}

function handleDelete(novel: Novel) {
  novelToDelete.value = novel
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  const novel = novelToDelete.value
  if (!novel) return
  try {
    await deleteNovel(novel.id)
    novels.value = novels.value.filter((n) => n.id !== novel.id)
  } catch (e) {
    toast.error('删除失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  } finally {
    deleteDialogOpen.value = false
    novelToDelete.value = null
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
          @click="openNewStoryDialog"
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
          <Button @click="openNewStoryDialog">
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

  <!-- New Story with Prompt Selection -->
  <Dialog v-model:open="newStoryDialogOpen">
    <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle>开始新故事</DialogTitle>
        <DialogDescription>
          选择要使用的提示词，它们将作为系统提示词发送给模型。
        </DialogDescription>
      </DialogHeader>

      <!-- Search dropdown -->
      <Popover v-model:open="promptPopoverOpen">
        <PopoverTrigger as-child>
          <button
            class="flex items-center border border-input rounded-lg px-2.5 py-1.5 text-sm h-9 w-full bg-transparent hover:border-primary/50 transition-colors outline-none"
          >
            <Search class="size-4 text-muted-foreground shrink-0 mr-2" />
            <span class="flex-1 text-left text-muted-foreground truncate">
              {{ promptSearch || '搜索提示词...' }}
            </span>
            <ChevronDown class="size-4 text-muted-foreground shrink-0 ml-1 transition-transform" :class="promptPopoverOpen ? 'rotate-180' : ''" />
          </button>
        </PopoverTrigger>
        <PopoverContent
          align="start"
          side="bottom"
          class="p-0 gap-0"
          :style="{ width: 'var(--reka-popover-trigger-width)' }"
        >
          <div class="px-1 pt-1 pb-0.5">
            <Input
              v-model="promptSearch"
              placeholder="搜索提示词..."
              class="border-0 h-8 text-sm shadow-none focus-visible:ring-0"
              @keydown.escape="promptPopoverOpen = false"
            />
          </div>
          <div v-if="availablePrompts.length" class="max-h-48 overflow-auto border-t border-border/50 px-1 pt-0.5 pb-1">
            <button
              v-for="p in availablePrompts"
              :key="p.id"
              class="w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors truncate hover:bg-muted"
              @mousedown.prevent="selectPrompt(p.id)"
            >
              {{ p.name }}
            </button>
          </div>
          <div v-else class="px-3 py-4 text-xs text-muted-foreground text-center">
            没有更多提示词
          </div>
        </PopoverContent>
      </Popover>

      <!-- Selected prompts list -->
      <div class="overflow-y-auto min-h-0 -mx-1 px-1" data-sortable-list @pointermove="onPointerMove">
        <div
          v-for="(prompt, idx) in selectedPrompts"
          :key="prompt.id"
          data-sortable-item
          class="flex items-center gap-2 py-1.5 rounded transition-colors select-none"
          :class="{
            'opacity-40': dragIndex === idx,
            'bg-primary/5': dragOverIndex === idx && dragIndex !== idx,
          }"
        >
          <GripVertical
            class="size-4 text-muted-foreground/40 shrink-0"
            :class="{
              'cursor-grab': true,
              'cursor-grabbing': dragIndex === idx,
            }"
            :style="{ touchAction: 'none' }"
            @pointerdown.prevent="onPointerDown($event, idx)"
            @pointerup="onPointerUp"
            @pointercancel="onPointerCancel"
          />
          <span class="text-sm flex-1 truncate">{{ prompt.name }}</span>
          <Badge v-if="prompt.isBuiltin" variant="secondary" class="text-[10px] px-1.5 py-0 shrink-0">
            内置
          </Badge>
          <div class="flex items-center gap-0.5 shrink-0">
            <button
              class="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
              :disabled="idx === 0"
              @click="movePromptUp(prompt.id)"
            >
              <ArrowUp class="size-3.5" />
            </button>
            <button
              class="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
              :disabled="idx === selectedPrompts.length - 1"
              @click="movePromptDown(prompt.id)"
            >
              <ArrowDown class="size-3.5" />
            </button>
            <button
              v-if="!prompt.isBuiltin"
              class="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-destructive hover:bg-destructive/10 transition-colors"
              @click="removePrompt(prompt.id)"
            >
              <X class="size-3.5" />
            </button>
          </div>
        </div>
      </div>

      <DialogFooter class="mt-2">
        <DialogClose as-child>
          <Button variant="outline">取消</Button>
        </DialogClose>
        <Button @click="startNewStory">开始创作</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- Delete Confirmation Dialog -->
  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>确认删除</DialogTitle>
        <DialogDescription>
          确定要删除《{{ novelToDelete?.title || '未命名故事' }}》吗？此操作不可撤销。
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline">取消</Button>
        </DialogClose>
        <Button variant="destructive" @click="confirmDelete">删除</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
