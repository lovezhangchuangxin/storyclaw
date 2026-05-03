<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { Search, ChevronDown, ArrowUp, ArrowDown, GripVertical, X } from 'lucide-vue-next'
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
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { getAllPrompts } from '@/db/prompts'
import type { Prompt } from '@/db/types'
import { usePromptDrag } from '@/composables/usePromptDrag'
import { toast } from 'vue-sonner'

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  create: [selectedPromptIds: string[]]
}>()

const allPrompts = ref<Prompt[]>([])
const selectedPromptIds = ref<string[]>(['builtin-persona'])
const promptSearch = ref('')
const promptPopoverOpen = ref(false)

const {
  dragIndex,
  dragOverIndex,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
  moveUp,
  moveDown,
} = usePromptDrag(selectedPromptIds)

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

watch(() => props.open, (val) => {
  if (!val) return
  selectedPromptIds.value = ['builtin-persona']
  promptSearch.value = ''
  promptPopoverOpen.value = false
  getAllPrompts()
    .then((ps) => {
      allPrompts.value = ps
    })
    .catch((e) => {
      toast.error('加载提示词失败', {
        description: e instanceof Error ? e.message : String(e),
      })
    })
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

function handleCreate() {
  emit('create', [...selectedPromptIds.value])
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle>开始新故事</DialogTitle>
        <DialogDescription>
          选择要使用的提示词，它们将作为系统提示词发送给模型。
        </DialogDescription>
      </DialogHeader>

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
              @click="moveUp(prompt.id)"
            >
              <ArrowUp class="size-3.5" />
            </button>
            <button
              class="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-muted disabled:opacity-30 disabled:hover:bg-transparent disabled:hover:text-muted-foreground transition-colors"
              :disabled="idx === selectedPrompts.length - 1"
              @click="moveDown(prompt.id)"
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
        <Button @click="handleCreate">开始创作</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
