<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Loader2 } from 'lucide-vue-next'
import { getToolDisplayInfo } from '@/agent/tools'

const props = defineProps<{
  toolName: string
  arguments?: Record<string, unknown>
  result?: string | null
  isStreaming?: boolean
}>()

const expanded = ref(false)

function toggle() {
  expanded.value = !expanded.value
}

const info = computed(() => getToolDisplayInfo(props.toolName))

const argSummary = computed(() => {
  if (!props.arguments) return ''
  const args = props.arguments
  switch (props.toolName) {
    case 'write_chapter':
    case 'rewrite_chapter': {
      const idx = args.index as number
      const chapter = typeof idx === 'number' ? `第${idx + 1}章` : ''
      const preview = typeof args.content === 'string' ? args.content.slice(0, 30).replace(/\n/g, ' ') : ''
      return [chapter, preview].filter(Boolean).join(' · ')
    }
    case 'plan_chapters': {
      const chapters = args.chapters as Array<{ title: string }> | undefined
      return chapters?.length ? `${chapters.length} 章 · ${chapters.map(c => c.title).join(', ')}` : ''
    }
    case 'create_character':
    case 'update_character': {
      const charName = args.name as string | undefined
      const role = args.role as string | undefined
      return `${charName || '未命名'}${role ? ` (${role})` : ''}`
    }
    default: {
      const keys = Object.keys(args).slice(0, 3)
      return keys.length ? keys.join(', ') : ''
    }
  }
})

const resultSummary = computed(() => {
  if (!props.result) return null
  try {
    const parsed = JSON.parse(props.result)
    if (parsed.error) return { success: false, text: parsed.error }
    const parts: string[] = []
    if (parsed.count !== undefined) parts.push(`${parsed.count} 项`)
    if (parsed.wordCount !== undefined) parts.push(`${parsed.wordCount} 字`)
    if (parsed.title) parts.push(parsed.title)
    if (parsed.index !== undefined && props.toolName !== 'write_chapter' && props.toolName !== 'rewrite_chapter')
      parts.push(`第${parsed.index + 1}章`)
    if (typeof parsed.name === 'string' && props.toolName !== 'create_character' && props.toolName !== 'update_character')
      parts.push(parsed.name)
    return { success: true, text: parts.join(' · ') || '操作成功' }
  } catch {
    return null
  }
})

const hasDetail = computed(() =>
  (props.arguments && Object.keys(props.arguments).length > 0) || !!props.result,
)
</script>

<template>
  <div class="flex justify-start">
    <div
      class="max-w-[85%] rounded-lg px-3 py-2 text-xs"
      :class="resultSummary?.success === false ? 'bg-red-50/30 dark:bg-red-950/10' : 'bg-muted/50'"
    >
      <button
        v-if="hasDetail"
        class="w-full text-left flex items-center gap-1.5 group"
        :class="resultSummary?.success === false ? 'text-destructive' : 'text-muted-foreground hover:text-foreground'"
        @click="toggle"
      >
        <span class="shrink-0">{{ info.icon }}</span>
        <span class="font-medium">{{ info.displayName }}</span>
        <span
          v-if="isStreaming"
          class="text-muted-foreground/50 italic flex items-center gap-1"
        >
          <Loader2 class="size-3 animate-spin" />
          执行中...
        </span>
        <span v-else-if="argSummary && !resultSummary" class="text-muted-foreground/60 truncate">
          — {{ argSummary }}
        </span>
        <span v-else-if="resultSummary" class="truncate" :class="resultSummary.success ? '' : 'text-destructive'">
          · {{ resultSummary.text }}
        </span>
        <ChevronDown
          class="size-3 shrink-0 ml-auto transition-transform duration-150"
          :class="expanded ? 'rotate-180' : ''"
        />
      </button>
      <div v-else class="flex items-center gap-1.5 text-muted-foreground">
        <span class="shrink-0">{{ info.icon }}</span>
        <span class="font-medium">{{ info.displayName }}</span>
        <span v-if="isStreaming" class="italic flex items-center gap-1">
          <Loader2 class="size-3 animate-spin" />
          执行中...
        </span>
        <span v-else-if="resultSummary" :class="resultSummary.success ? '' : 'text-destructive'">
          · {{ resultSummary.text }}
        </span>
      </div>
      <div
        v-if="expanded && hasDetail"
        class="mt-1.5 text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto space-y-1.5"
      >
        <div v-if="arguments && Object.keys(arguments).length > 0">
          <div class="text-muted-foreground/50 mb-0.5">参数</div>
          <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ JSON.stringify(arguments, null, 2) }}</pre>
        </div>
        <div v-if="result">
          <div class="text-muted-foreground/50 mb-0.5">结果</div>
          <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ result }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
