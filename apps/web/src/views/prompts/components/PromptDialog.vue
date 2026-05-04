<script setup lang="ts">
import { computed, ref, watch } from 'vue'
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

const readonly = computed(() => props.prompt?.isBuiltin ?? false)
const isEdit = computed(() => !!props.prompt)
const title = computed(() => {
  if (readonly.value) return '查看提示词'
  return isEdit.value ? '编辑提示词' : '新建提示词'
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
    nameError.value = '名称不能为空'
    return
  }
  if (!trimmedContent) {
    toast.error('内容不能为空')
    return
  }

  saving.value = true
  try {
    const dup = await isPromptNameDuplicate(trimmedName, props.prompt?.id)
    if (dup) {
      nameError.value = '提示词名称已存在'
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
    toast.error('保存失败', {
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
          <Label>名称</Label>
          <Input
            v-model="name"
            placeholder="输入提示词名称"
            :disabled="readonly"
            :class="nameError ? 'border-destructive' : ''"
            @input="nameError = ''"
          />
          <p v-if="nameError" class="text-xs text-destructive">{{ nameError }}</p>
        </div>

        <div class="space-y-1.5">
          <Label>内容</Label>
          <Textarea
            v-model="content"
            placeholder="输入提示词内容，将作为系统提示词发送给模型"
            :disabled="readonly"
            class="min-h-[200px] max-h-[50vh] resize-none"
          />
        </div>
      </div>

      <div class="flex justify-end gap-2 mt-4">
        <Button variant="outline" @click="emit('update:open', false)">
          {{ readonly ? '关闭' : '取消' }}
        </Button>
        <Button v-if="!readonly" :disabled="saving" @click="handleSave">
          {{ isEdit ? '保存' : '创建' }}
        </Button>
      </div>
    </DialogContent>
  </Dialog>
</template>
