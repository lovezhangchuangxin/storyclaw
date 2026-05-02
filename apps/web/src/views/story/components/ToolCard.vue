<script setup lang="ts">
import { ref, computed } from 'vue'
import { ChevronDown, Loader2 } from 'lucide-vue-next'
import { getToolDisplayInfo } from '@/agent/tools'

const props = defineProps<{
  toolName: string
  rawArguments?: string
  parsedArguments?: Record<string, unknown> | null
  result?: string | null
  status?: 'pending' | 'completed' | 'cancelled' | 'error'
}>()

const expanded = ref(false)

function toggle() {
  expanded.value = !expanded.value
}

const info = computed(() => getToolDisplayInfo(props.toolName))

function safeStringify(value: unknown): string {
  const seen = new WeakSet<object>()

  return JSON.stringify(
    value,
    (_key, nestedValue) => {
      if (typeof nestedValue === 'bigint') {
        return nestedValue.toString()
      }

      if (!nestedValue || typeof nestedValue !== 'object') {
        return nestedValue
      }

      if (seen.has(nestedValue)) {
        return '[Circular]'
      }

      seen.add(nestedValue)
      return nestedValue
    },
    2,
  )
}

function extractStreamingToolPreview(raw: string): {
  chapter?: string
  preview?: string
  wordCount: number
} {
  const idxMatch = raw.match(/"index"\s*:\s*(\d+)/)
  const contentMatch = raw.match(/"content"\s*:\s*"((?:[^"\\]|\\.)*)/)
  const index = idxMatch ? Number.parseInt(idxMatch[1], 10) : undefined

  let preview = ''
  let wordCount = 0
  if (contentMatch) {
    const rawContent = contentMatch[1]
    preview = rawContent.replace(/\\"/g, '"').replace(/\\n/g, '\n').slice(0, 30)
    wordCount = (rawContent.match(/[\u4e00-\u9fa5]|[a-zA-Z]+/g) || []).length
  }

  return {
    chapter: index !== undefined ? `第${index + 1}章` : undefined,
    preview: preview || undefined,
    wordCount,
  }
}

const argSummary = computed(() => {
  const args = props.parsedArguments
  if (!args) {
    if (
      props.rawArguments
      && (props.toolName === 'write_chapter' || props.toolName === 'rewrite_chapter')
    ) {
      const preview = extractStreamingToolPreview(props.rawArguments)
      return [preview.chapter, preview.preview, preview.wordCount > 0 ? `${preview.wordCount} 字` : '']
        .filter(Boolean)
        .join(' · ')
    }
    return ''
  }
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
  if (props.status === 'cancelled') return { success: false, text: '已取消' }
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
  !!props.rawArguments
  || (props.parsedArguments && Object.keys(props.parsedArguments).length > 0)
  || !!props.result,
)

const parsedArgumentsText = computed(() => {
  if (!props.parsedArguments || Object.keys(props.parsedArguments).length === 0) {
    return ''
  }
  try {
    return safeStringify(props.parsedArguments)
  } catch {
    return '[Unserializable arguments]'
  }
})

const cardClass = computed(() => {
  if (props.status === 'error' || resultSummary.value?.success === false) {
    return 'bg-red-50/30 dark:bg-red-950/10'
  }
  if (props.status === 'cancelled') {
    return 'bg-amber-50/30 dark:bg-amber-950/10'
  }
  return 'bg-muted/50'
})

const textClass = computed(() => {
  if (props.status === 'error' || resultSummary.value?.success === false) {
    return 'text-destructive'
  }
  if (props.status === 'cancelled') {
    return 'text-amber-700 dark:text-amber-300'
  }
  return 'text-muted-foreground hover:text-foreground'
})
</script>

<template>
  <div class="flex justify-start">
    <div
      class="max-w-[85%] rounded-lg px-3 py-2 text-xs"
      :class="cardClass"
    >
      <button
        v-if="hasDetail"
        class="w-full text-left flex items-center gap-1.5 group"
        :class="textClass"
        @click="toggle"
      >
        <span class="shrink-0">{{ info.icon }}</span>
        <span class="font-medium">{{ info.displayName }}</span>
        <span
          v-if="status === 'pending'"
          class="text-muted-foreground/50 italic flex items-center gap-1"
        >
          <Loader2 class="size-3 animate-spin" />
          执行中...
        </span>
        <span v-else-if="status === 'cancelled'" class="italic">
          · 已取消
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
        <span v-if="status === 'pending'" class="italic flex items-center gap-1">
          <Loader2 class="size-3 animate-spin" />
          执行中...
        </span>
        <span v-else-if="status === 'cancelled'" class="italic">
          · 已取消
        </span>
        <span v-else-if="resultSummary" :class="resultSummary.success ? '' : 'text-destructive'">
          · {{ resultSummary.text }}
        </span>
      </div>
      <div
        v-if="expanded && hasDetail"
        class="mt-1.5 text-xs font-mono bg-muted/30 rounded p-2 overflow-x-auto max-h-40 overflow-y-auto space-y-1.5"
      >
        <div v-if="parsedArgumentsText">
          <div class="text-muted-foreground/50 mb-0.5">参数</div>
          <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ parsedArgumentsText }}</pre>
        </div>
        <div v-else-if="rawArguments">
          <div class="text-muted-foreground/50 mb-0.5">参数</div>
          <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ rawArguments }}</pre>
        </div>
        <div v-if="result">
          <div class="text-muted-foreground/50 mb-0.5">结果</div>
          <pre class="whitespace-pre-wrap break-all text-muted-foreground">{{ result }}</pre>
        </div>
      </div>
    </div>
  </div>
</template>
