<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Sparkles, FileText } from 'lucide-vue-next'
import { getAllPrompts, ensureRoleplayBuiltinPrompt } from '@/db/prompts'
import type { Prompt } from '@/db/types'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  create: [promptId: string]
}>()

const allPrompts = ref<Prompt[]>([])
const selectedPromptId = ref<string | null>(null)
const promptSearch = ref('')

const availablePrompts = computed(() => {
  const q = promptSearch.value.toLowerCase()
  return allPrompts.value.filter((p) => !q || p.name.toLowerCase().includes(q))
})

watch(
  () => props.open,
  async (val) => {
    if (!val) return
    selectedPromptId.value = null
    promptSearch.value = ''
    await ensureRoleplayBuiltinPrompt()
    getAllPrompts()
      .then((ps) => {
        allPrompts.value = ps.filter((p) => p.scenario === 'roleplay' || p.scenario === 'both')
      })
      .catch((e) => {
        toast.error(t('roleplay.newDialog.noPrompts'), {
          description: e instanceof Error ? e.message : String(e),
        })
      })
  },
)

function handleCreate() {
  if (selectedPromptId.value) {
    emit('create', selectedPromptId.value)
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
    >
      <DialogHeader>
        <DialogTitle>{{ $t('roleplay.newDialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ $t('roleplay.newDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <div class="relative shrink-0">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
        />
        <Input
          v-model="promptSearch"
          :placeholder="$t('roleplay.newDialog.searchPrompts')"
          class="pl-8"
        />
      </div>

      <div class="flex-1 min-h-0 overflow-y-auto space-y-1">
        <button
          v-for="p in availablePrompts"
          :key="p.id"
          class="w-full text-left rounded-lg border px-3 py-1.5 transition-all"
          :class="{
            'border-primary/40 bg-primary/5 shadow-sm': selectedPromptId === p.id,
            'border-border hover:border-primary/20 hover:bg-muted/50': selectedPromptId !== p.id,
          }"
          @click="selectedPromptId = p.id"
        >
          <div class="flex items-center gap-2">
            <component
              :is="p.scenario === 'both' ? Sparkles : FileText"
              class="size-4 shrink-0"
              :class="selectedPromptId === p.id ? 'text-primary' : 'text-muted-foreground'"
            />
            <span class="font-medium text-sm truncate">{{ p.name }}</span>
            <span
              v-if="p.isBuiltin"
              class="ml-auto shrink-0 rounded-full bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary"
            >
              {{ $t('prompts.builtin') }}
            </span>
          </div>
        </button>
        <div
          v-if="availablePrompts.length === 0"
          class="flex flex-col items-center gap-2 py-8 text-muted-foreground"
        >
          <FileText class="size-8 opacity-40" />
          <p class="text-xs">{{ $t('roleplay.newDialog.noPrompts') }}</p>
        </div>
      </div>

      <DialogFooter class="shrink-0">
        <DialogClose as-child>
          <Button variant="outline">{{ $t('common.cancel') }}</Button>
        </DialogClose>
        <Button :disabled="!selectedPromptId" @click="handleCreate">
          {{ $t('roleplay.newDialog.start') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
