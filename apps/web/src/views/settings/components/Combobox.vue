<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { ChevronDown } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: string[]
    placeholder?: string
  }>(),
  {
    placeholder: '请选择或输入',
  },
)

const emit = defineEmits<{
  'update:modelValue': [v: string]
  open: []
}>()

const open = ref(false)
const search = ref(props.modelValue)

watch(
  () => props.modelValue,
  (v) => {
    search.value = v
  },
)

const filtered = computed(() => {
  if (!search.value) return props.options
  const q = search.value.toLowerCase()
  return props.options.filter((o) => o.toLowerCase().includes(q))
})

function select(opt: string) {
  emit('update:modelValue', opt)
  search.value = opt
  open.value = false
}

function commit() {
  emit('update:modelValue', search.value)
  open.value = false
}

watch(open, (val) => {
  if (val) {
    emit('open')
    return
  }
  if (search.value !== props.modelValue) {
    emit('update:modelValue', search.value)
  }
})
</script>

<template>
  <Popover v-model:open="open" class="w-full">
    <PopoverTrigger as-child>
      <button
        class="flex items-center border border-input rounded-lg px-2.5 py-1 text-sm h-8 w-full bg-transparent hover:border-primary/50 focus-within:border-ring transition-colors outline-none"
      >
        <span v-if="modelValue" class="flex-1 text-left truncate">{{ modelValue }}</span>
        <span v-else class="flex-1 text-left text-muted-foreground truncate">{{
          placeholder
        }}</span>
        <ChevronDown
          class="size-4 text-muted-foreground shrink-0 ml-1 transition-transform"
          :class="open ? 'rotate-180' : ''"
        />
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
          :model-value="search"
          :placeholder="placeholder"
          class="border-0 h-8 text-sm shadow-none focus-visible:ring-0"
          @update:model-value="search = $event as string"
          @keydown.enter.prevent="commit"
          @keydown.escape="open = false"
        />
      </div>
      <div
        v-if="filtered.length"
        class="max-h-48 overflow-auto border-t border-border/50 px-1 pt-0.5 pb-1"
      >
        <button
          v-for="opt in filtered"
          :key="opt"
          class="w-full text-left px-2 py-1.5 text-sm rounded-sm transition-colors truncate"
          :class="opt === modelValue ? 'bg-primary/10 text-primary' : 'hover:bg-muted'"
          @mousedown.prevent="select(opt)"
        >
          {{ opt }}
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>
