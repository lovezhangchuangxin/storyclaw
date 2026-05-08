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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { Search, Sparkles, FileText, ChevronDown } from 'lucide-vue-next'
import {
  getAllPrompts,
  ensureRoleplayBuiltinPrompt,
  ensureCultivationBuiltinPrompt,
} from '@/db/prompts'
import { getConfig } from '@/db/config'
import { getAllModels } from '@/composables/useModels'
import { modelLabel } from '@/lib/model-utils'
import type { Prompt, ModelConfig } from '@/db/types'

const { t } = useI18n()

const props = defineProps<{
  open: boolean
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  create: [promptId: string, modelId: string]
}>()

const allPrompts = ref<Prompt[]>([])
const selectedPromptId = ref<string | null>(null)
const promptSearch = ref('')

const models = ref<ModelConfig[]>([])
const selectedModelId = ref('')
let loadSeq = 0

const selectedModel = computed(() => models.value.find((m) => m.id === selectedModelId.value))

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
    await Promise.all([ensureRoleplayBuiltinPrompt(), ensureCultivationBuiltinPrompt()])
    const seq = ++loadSeq
    getAllPrompts()
      .then((ps) => {
        if (seq !== loadSeq) return
        allPrompts.value = ps.filter((p) => p.scenario === 'roleplay' || p.scenario === 'both')
      })
      .catch((e) => {
        toast.error(t('roleplay.newDialog.noPrompts'), {
          description: e instanceof Error ? e.message : String(e),
        })
      })
    // Load models and select default
    Promise.all([getAllModels(), getConfig()])
      .then(([ms, config]) => {
        if (seq !== loadSeq) return
        models.value = ms
        const defaultExists = ms.some((m) => m.id === config.defaultModelId)
        selectedModelId.value = defaultExists ? config.defaultModelId : ms[0]?.id || ''
      })
      .catch(() => {
        // Models failed to load - selector stays hidden (v-if="models.length > 0")
      })
  },
)

function handleCreate() {
  if (selectedPromptId.value) {
    emit('create', selectedPromptId.value, selectedModelId.value)
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

      <!-- Model selector -->
      <DropdownMenu v-if="models.length > 0">
        <DropdownMenuTrigger
          as="button"
          class="flex items-center gap-1.5 border border-input rounded-lg px-2.5 py-1.5 text-sm h-9 w-full bg-transparent hover:border-primary/50 transition-colors outline-none"
        >
          <span
            class="flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70 shrink-0"
          >
            {{ selectedModel?.provider?.[0]?.toUpperCase() ?? '?' }}
          </span>
          <span class="flex-1 text-left truncate">
            {{ selectedModel ? modelLabel(selectedModel) : $t('roleplay.newDialog.selectModel') }}
          </span>
          <ChevronDown class="size-3.5 text-muted-foreground shrink-0" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="min-w-[200px]">
          <DropdownMenuItem
            v-for="model in models"
            :key="model.id"
            class="flex items-center gap-2"
            @click="selectedModelId = model.id"
          >
            <span
              class="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70"
            >
              {{ model.provider?.[0]?.toUpperCase() ?? '?' }}
            </span>
            <span class="text-xs">{{ modelLabel(model) }}</span>
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
