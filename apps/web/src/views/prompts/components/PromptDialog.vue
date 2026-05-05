<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { toast } from 'vue-sonner'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { isPromptNameDuplicate } from '@/db/prompts'
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
const saving = ref(false)
const nameError = ref('')

watch(
  () => props.open,
  (val) => {
    if (!val) return
    if (props.prompt) {
      name.value = props.prompt.name
      content.value = props.prompt.content
    } else {
      name.value = ''
      content.value = ''
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
      id: props.prompt?.id ?? crypto.randomUUID(),
      name: trimmedName,
      content: trimmedContent,
      isBuiltin: props.prompt?.isBuiltin ?? false,
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
    <DialogContent class="max-w-[calc(100vw-2rem)] sm:max-w-lg max-h-[85vh] overflow-hidden">
      <DialogHeader>
        <DialogTitle>{{ title }}</DialogTitle>
      </DialogHeader>

      <div class="space-y-4 mt-2">
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
          <Label>{{ $t('prompts.dialog.contentLabel') }}</Label>
          <Textarea
            v-model="content"
            :placeholder="readonly ? '' : $t('prompts.dialog.contentPlaceholder')"
            :disabled="readonly"
            class="min-h-[200px] max-h-[50vh] resize-none"
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
