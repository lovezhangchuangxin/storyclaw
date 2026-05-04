<script setup lang="ts">
import { computed, ref } from 'vue'
import { ChevronDown, Brain } from 'lucide-vue-next'

const props = defineProps<{
  content: string
}>()

const expanded = ref(false)

function toggle() {
  expanded.value = !expanded.value
}

const preview = computed(() => {
  const head = props.content.slice(0, 80)
  return props.content.length > 80 ? `${head}…` : head
})
</script>

<template>
  <div class="flex flex-col w-full">
    <button
      class="flex items-center gap-1.5 text-xs w-full text-left border-l-2 border-muted-foreground/[0.10] pl-2.5 pr-3 py-0.5 hover:border-muted-foreground/[0.18] transition-colors duration-200 group cursor-pointer select-none"
      @click="toggle"
    >
      <Brain
        class="size-3 shrink-0 text-muted-foreground/40 group-hover:text-muted-foreground/60 transition-colors duration-200"
      />

      <!-- Collapsed: label + preview -->
      <template v-if="!expanded">
        <span class="font-medium text-muted-foreground/50 shrink-0">思考过程</span>
        <span class="text-muted-foreground/35 truncate min-w-0">{{ preview }}</span>
      </template>

      <!-- Expanded: label + word count + chevron -->
      <template v-else>
        <span class="font-medium text-muted-foreground/70">思考过程</span>
        <span class="text-muted-foreground/35 tabular-nums">{{ content.length }} 字</span>
        <ChevronDown
          class="size-3 shrink-0 ml-auto text-muted-foreground/35 transition-transform duration-200 rotate-180"
        />
      </template>
    </button>

    <!-- Expandable content area -->
    <div
      class="overflow-hidden transition-all duration-300 ease-out"
      :class="expanded ? 'max-h-80 opacity-100 mt-1' : 'max-h-0 opacity-0'"
    >
      <div class="think-scroll bg-muted/30 rounded-lg px-3 py-2.5 max-h-72 overflow-y-auto">
        <pre
          class="whitespace-pre-wrap text-xs font-mono text-muted-foreground/65 leading-relaxed"
          >{{ content }}</pre
        >
      </div>
    </div>
  </div>
</template>

<style scoped>
.think-scroll::-webkit-scrollbar {
  width: 5px;
}
.think-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.think-scroll::-webkit-scrollbar-thumb {
  background: oklch(0.922 0 0);
  border-radius: 3px;
}
.think-scroll::-webkit-scrollbar-thumb:hover {
  background: oklch(0.87 0 0);
}
.dark .think-scroll::-webkit-scrollbar-thumb {
  background: oklch(0.269 0 0);
}
.dark .think-scroll::-webkit-scrollbar-thumb:hover {
  background: oklch(0.371 0 0);
}
</style>
