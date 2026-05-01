<script setup lang="ts">
import { ref } from 'vue'
import { ChevronDown, Brain } from 'lucide-vue-next'

const props = defineProps<{
  content: string
}>()

const expanded = ref(false)

function toggle() {
  expanded.value = !expanded.value
}
</script>

<template>
  <div class="border border-purple-200/30 dark:border-purple-800/30 rounded-lg px-3 py-2">
    <button
      class="w-full text-left flex items-center gap-1.5 text-xs text-purple-600/70 dark:text-purple-400/70 hover:text-purple-600 dark:hover:text-purple-300 transition-colors py-0.5 group"
      @click="toggle"
    >
      <Brain class="size-3.5 shrink-0" />
      <span class="font-medium">思考过程</span>
      <span class="text-muted-foreground/40 tabular-nums">{{ content.length }} 字</span>
      <ChevronDown
        class="size-3 shrink-0 ml-auto transition-transform duration-150"
        :class="expanded ? 'rotate-180' : ''"
      />
    </button>
    <div
      v-if="expanded"
      class="mt-1.5 text-xs bg-purple-50/50 dark:bg-purple-950/20 rounded p-2.5 overflow-x-auto max-h-60 overflow-y-auto"
    >
      <pre class="whitespace-pre-wrap break-all text-purple-700/80 dark:text-purple-300/70 leading-relaxed">{{ content }}</pre>
    </div>
  </div>
</template>
