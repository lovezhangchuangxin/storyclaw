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
import { Search } from 'lucide-vue-next'
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
        allPrompts.value = ps.filter(
          (p) => p.scenario === 'roleplay' || p.scenario === 'both' || !p.scenario,
        )
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
    <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle>{{ $t('roleplay.newDialog.title') }}</DialogTitle>
        <DialogDescription>
          {{ $t('roleplay.newDialog.description') }}
        </DialogDescription>
      </DialogHeader>

      <div class="relative">
        <Search
          class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
        />
        <Input
          v-model="promptSearch"
          :placeholder="$t('roleplay.newDialog.searchPrompts')"
          class="pl-8"
        />
      </div>

      <div class="overflow-y-auto min-h-0 max-h-60 space-y-1 -mx-1 px-1">
        <button
          v-for="p in availablePrompts"
          :key="p.id"
          class="w-full text-left px-3 py-2 rounded-lg text-sm transition-colors"
          :class="{
            'bg-primary/10 border border-primary/30': selectedPromptId === p.id,
            'hover:bg-muted border border-transparent': selectedPromptId !== p.id,
          }"
          @click="selectedPromptId = p.id"
        >
          <span class="font-medium">{{ p.name }}</span>
        </button>
        <div v-if="availablePrompts.length === 0" class="py-6 text-center">
          <p class="text-xs text-muted-foreground">{{ $t('roleplay.newDialog.noPrompts') }}</p>
        </div>
      </div>

      <DialogFooter>
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
