<script setup lang="ts">
import { ref } from 'vue'
import type { ChoiceItem } from './types'

const props = defineProps<{
  prompt: string
  choices: ChoiceItem[]
  disabled?: boolean
}>()

const emit = defineEmits<{
  select: [choiceId: string, choiceText: string]
}>()

const selectedId = ref<string | null>(null)

function handleSelect(choice: ChoiceItem) {
  selectedId.value = choice.id
  emit('select', choice.id, choice.text)
}
</script>

<template>
  <div class="rounded-lg border bg-card p-3 shadow-sm space-y-2">
    <p class="text-sm font-medium text-foreground">{{ prompt }}</p>
    <div class="space-y-1.5">
      <button
        v-for="choice in choices"
        :key="choice.id"
        class="w-full text-left rounded-md border px-3 py-2 text-sm transition-all hover:border-primary/40 hover:bg-primary/5"
        :class="{
          'border-primary/50 bg-primary/5': selectedId === choice.id,
          'border-border': selectedId !== choice.id,
        }"
        :disabled="!!selectedId || disabled"
        @click="handleSelect(choice)"
      >
        <span class="font-medium">{{ choice.text }}</span>
        <p v-if="choice.description" class="text-xs text-muted-foreground mt-0.5">
          {{ choice.description }}
        </p>
      </button>
    </div>
  </div>
</template>
