<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Copy } from 'lucide-vue-next'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isPromptNameDuplicate } from '@/db/prompts'
import { uuid } from '@/lib/utils'
import type { Prompt } from '@/db/types'

const props = defineProps<{
  open: boolean
  prompt?: Prompt | null
}>()

const emit = defineEmits<{
  'update:open': [v: boolean]
  save: [prompt: Prompt]
}>()

const { t } = useI18n()

const readonly = computed(() => props.prompt?.isBuiltin ?? false)
const isEdit = computed(() => !!props.prompt)
const title = computed(() => {
  if (readonly.value) return t('prompts.dialog.viewTitle')
  return isEdit.value ? t('prompts.dialog.editTitle') : t('prompts.dialog.newTitle')
})

const name = ref('')
const content = ref('')
const scenario = ref<'novel' | 'roleplay' | 'both'>('novel')
const initialMessage = ref('')
const saving = ref(false)
const nameError = ref('')
const contentCopied = ref(false)

async function copyContent() {
  try {
    await navigator.clipboard.writeText(content.value)
    contentCopied.value = true
    setTimeout(() => {
      contentCopied.value = false
    }, 2000)
  } catch {
    toast.error(t('story.agent.copyFailed'))
  }
}

const scenarioOptions = computed(() => [
  { value: 'novel' as const, label: t('prompts.dialog.scenarioNovel') },
  { value: 'roleplay' as const, label: t('prompts.dialog.scenarioRoleplay') },
  { value: 'both' as const, label: t('prompts.dialog.scenarioBoth') },
])

watch(
  () => props.open,
  (val) => {
    if (!val) return
    if (props.prompt) {
      name.value = props.prompt.name
      content.value = props.prompt.content
      scenario.value = props.prompt.scenario ?? 'novel'
      initialMessage.value = props.prompt.initialMessage ?? ''
    } else {
      name.value = ''
      content.value = ''
      scenario.value = 'novel'
      initialMessage.value = ''
    }
    nameError.value = ''
  },
)

async function handleSave() {
  const trimmedName = name.value.trim()
  const trimmedContent = content.value.trim()

  if (!trimmedName) {
    nameError.value = t('prompts.dialog.nameRequired')
    return
  }
  if (!trimmedContent) {
    toast.error(t('prompts.dialog.contentRequired'))
    return
  }

  saving.value = true
  try {
    const dup = await isPromptNameDuplicate(trimmedName, props.prompt?.id)
    if (dup) {
      nameError.value = t('prompts.dialog.nameDuplicate')
      saving.value = false
      return
    }

    emit('save', {
      id: props.prompt?.id ?? uuid(),
      name: trimmedName,
      content: trimmedContent,
      isBuiltin: props.prompt?.isBuiltin ?? false,
      scenario: scenario.value,
      initialMessage:
        scenario.value !== 'novel' && initialMessage.value.trim()
          ? initialMessage.value.trim()
          : undefined,
      createdAt: props.prompt?.createdAt ?? Date.now(),
      updatedAt: Date.now(),
    })
    emit('update:open', false)
  } catch (e) {
    toast.error(t('common.saveFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <Dialog :open="open" @update:open="emit('update:open', $event)">
    <DialogContent
      class="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] flex flex-col overflow-hidden"
    >
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 mt-2 flex-1 overflow-y-auto min-h-0">
        <div class="space-y-1.5">
          <Label>{{ $t('prompts.dialog.nameLabel') }}</Label>
          <Input
            v-model="name"
            :placeholder="readonly ? '' : $t('prompts.dialog.namePlaceholder')"
            :disabled="readonly"
            :class="nameError ? 'border-destructive' : ''"
            @input="nameError = ''"
          />
          <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        </div>

        <div class="space-y-1.5">
          <Label>{{ $t('prompts.dialog.scenario') }}</Label>
          <div class="flex gap-1.5" v-if="!readonly">
            <button
              v-for="opt in scenarioOptions"
              :key="opt.value"
              class="flex-1 rounded-md border px-3 py-1.5 text-xs transition-colors"
              :class="{
                'border-primary bg-primary/10 text-primary': scenario === opt.value,
                'border-border hover:bg-muted': scenario !== opt.value,
              }"
              @click="scenario = opt.value"
            >
              {{ opt.label }}
            </button>
          </div>
          <p v-else class="text-sm text-muted-foreground">
            {{
              scenario === 'roleplay'
                ? $t('prompts.dialog.scenarioRoleplay')
                : scenario === 'both'
                  ? $t('prompts.dialog.scenarioBoth')
                  : $t('prompts.dialog.scenarioNovel')
            }}
          </p>
        </div>

        <div class="space-y-1.5">
          <div class="flex items-center justify-between">
            <Label>{{ $t('prompts.dialog.contentLabel') }}</Label>
            <button
              v-if="readonly"
              class="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              @click="copyContent"
            >
              <Copy class="size-3" />
              {{ contentCopied ? '✓' : $t('prompts.dialog.contentCopy') }}
            </button>
          </div>
          <Textarea
            v-model="content"
            :placeholder="readonly ? '' : $t('prompts.dialog.contentPlaceholder')"
            :disabled="readonly"
            class="min-h-[160px] max-h-[40vh] resize-none"
          />
        </div>

        <div v-if="scenario !== 'novel'" class="space-y-1.5">
          <Label>{{ $t('prompts.dialog.initialMessage') }}</Label>
          <Input
            v-model="initialMessage"
            :placeholder="$t('prompts.dialog.initialMessageHint')"
            :disabled="readonly"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <Button variant="outline" @click="emit('update:open', false)">
          {{ $t('common.cancel') }}
        </Button>
        <Button v-if="!readonly" :disabled="saving" @click="handleSave">
          {{ isEdit ? $t('common.save') : $t('common.create') }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
