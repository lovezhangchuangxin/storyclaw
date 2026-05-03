<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { Plus, Trash2, Search } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Badge } from '@/components/ui/badge'
import { getAllPrompts, deletePrompt, savePrompt } from '@/db/prompts'
import type { Prompt } from '@/db/types'
import { toast } from 'vue-sonner'
import PromptDialog from './components/PromptDialog.vue'

const prompts = ref<Prompt[]>([])
const loading = ref(true)
const error = ref(false)
const searchQuery = ref('')

const dialogOpen = ref(false)
const editingPrompt = ref<Prompt | null>(null)
const deleteDialogOpen = ref(false)
const promptToDelete = ref<Prompt | null>(null)

const filteredPrompts = computed(() => {
  if (!searchQuery.value.trim()) return prompts.value
  const q = searchQuery.value.toLowerCase()
  return prompts.value.filter(
    (p) =>
      p.name.toLowerCase().includes(q) ||
      p.content.toLowerCase().includes(q),
  )
})

onMounted(loadPrompts)

async function loadPrompts() {
  loading.value = true
  error.value = false
  try {
    prompts.value = await getAllPrompts()
  } catch {
    error.value = true
  } finally {
    loading.value = false
  }
}

function openCreate() {
  editingPrompt.value = null
  dialogOpen.value = true
}

function openEdit(prompt: Prompt) {
  editingPrompt.value = prompt
  dialogOpen.value = true
}

async function handleSave(prompt: Prompt) {
  await savePrompt(prompt)
  const existing = prompts.value.findIndex((p) => p.id === prompt.id)
  if (existing !== -1) {
    prompts.value[existing] = prompt
  } else {
    prompts.value.push(prompt)
  }
}

function handleDelete(prompt: Prompt) {
  promptToDelete.value = prompt
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  const prompt = promptToDelete.value
  if (!prompt) return
  try {
    await deletePrompt(prompt.id)
    prompts.value = prompts.value.filter((p) => p.id !== prompt.id)
  } catch (e) {
    toast.error('删除失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  } finally {
    deleteDialogOpen.value = false
    promptToDelete.value = null
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
          @click="loadPrompts"
        >
          重试
        </button>
      </section>
    </template>

    <!-- Loaded State -->
    <template v-else>
      <!-- Toolbar -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <Input
            v-model="searchQuery"
            placeholder="搜索提示词..."
            class="pl-8"
          />
        </div>
        <Button size="sm" class="shrink-0 gap-1.5" @click="openCreate">
          <Plus class="size-4" />
          新建
        </Button>
      </div>

      <!-- Empty search results -->
      <template v-if="filteredPrompts.length === 0 && prompts.length > 0">
        <section class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center">
          <Search class="size-8 mb-3 text-muted-foreground/30" />
          <p class="text-sm text-muted-foreground">没有找到匹配的提示词</p>
        </section>
      </template>

      <!-- Prompt Grid -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="prompt in filteredPrompts"
          :key="prompt.id"
          class="rounded-xl border bg-card overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 group cursor-pointer"
          role="button"
          tabindex="0"
          @click="openEdit(prompt)"
          @keydown.enter="openEdit(prompt)"
        >
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <h3 class="font-semibold text-sm leading-snug line-clamp-1">
                  {{ prompt.name }}
                </h3>
                <Badge v-if="prompt.isBuiltin" variant="secondary" class="shrink-0 text-[10px] px-1.5 py-0">
                  内置
                </Badge>
              </div>
              <button
                v-if="!prompt.isBuiltin"
                class="size-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                title="删除"
                @click.stop="handleDelete(prompt)"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
            <p class="text-xs text-muted-foreground mt-1.5 line-clamp-3 leading-relaxed whitespace-pre-wrap">
              {{ prompt.content }}
            </p>
          </div>
        </div>
      </section>
    </template>
  </div>

  <!-- Create/Edit Dialog -->
  <PromptDialog
    :open="dialogOpen"
    :prompt="editingPrompt"
    @update:open="dialogOpen = $event"
    @save="handleSave"
  />

  <!-- Delete Confirmation Dialog -->
  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>确认删除</DialogTitle>
        <DialogDescription>
          确定要删除提示词「{{ promptToDelete?.name }}」吗？此操作不可撤销。
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
