<script setup lang="ts">
import { computed, ref, toRaw } from 'vue'
import { useI18n } from 'vue-i18n'
import {
  ChevronDown,
  Loader2,
  CheckCircle2,
  XCircle,
  MinusCircle,
  PenLine,
  ListOrdered,
  UserPlus,
  UserPen,
} from 'lucide-vue-next'
import { getToolDisplayInfo, getToolDisplayConfig } from '@/agent/tools'
import JsonTreeViewer from '@/components/json-tree/JsonTreeViewer.vue'
import ToolFieldRenderer from './ToolFieldRenderer.vue'

const { t } = useI18n()

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

// Tool display info (name + icon from registry)
const info = computed(() => getToolDisplayInfo(props.toolName))

// Tool display config (human-readable field configs)
const config = computed(() => getToolDisplayConfig(props.toolName))

const hasArgConfig = computed(() => {
  const cfg = config.value?.argFields
  return (
    cfg &&
    cfg.length > 0 &&
    !!props.parsedArguments &&
    Object.keys(props.parsedArguments).length > 0
  )
})

const hasResultConfig = computed(() => {
  const cfg = config.value?.resultFields
  return cfg && cfg.length > 0 && parsedResult.value !== null
})

// ── normalizeJsonValue ─────────────────────────────────

function normalizeJsonValue(value: unknown, seen = new WeakMap<object, unknown>()): unknown {
  if (value === null || value === undefined) return value
  if (typeof value === 'bigint') return value.toString()
  if (typeof value !== 'object') return value
  if (value instanceof String) return value.valueOf()
  if (value instanceof Number) return value.valueOf()
  if (value instanceof Boolean) return value.valueOf()

  const raw = toRaw(value as object) as unknown
  if (raw === null || raw === undefined) return raw
  if (typeof raw === 'bigint') return raw.toString()
  if (typeof raw !== 'object') return raw
  if (raw instanceof String) return raw.valueOf()
  if (raw instanceof Number) return raw.valueOf()
  if (raw instanceof Boolean) return raw.valueOf()
  if (seen.has(raw)) return '[Circular]'

  if (Array.isArray(raw)) {
    const result: unknown[] = []
    seen.set(raw, result)
    for (const item of raw) result.push(normalizeJsonValue(item, seen))
    return result
  }

  const result: Record<string, unknown> = {}
  seen.set(raw, result)
  for (const [key, nestedValue] of Object.entries(raw)) {
    const normalized = normalizeJsonValue(nestedValue, seen)
    if (normalized !== undefined) result[key] = normalized
  }
  return result
}

// ── Streaming preview (for write_chapter during pending) ──

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
    chapter: index !== undefined ? t('story.tool.chapterFormat', { index: index + 1 }) : undefined,
    preview: preview || undefined,
    wordCount,
  }
}

// ── Header summary ───────────────────────────────────

const argSummary = computed(() => {
  const args = props.parsedArguments

  // If config has argPreview and parsed args are available, use it
  if (args && config.value?.argPreview) {
    if (typeof config.value.argPreview === 'function') {
      return config.value.argPreview(args)
    }
    return config.value.argPreview
  }

  // Streaming fallback for write_chapter
  if (!args && props.rawArguments && props.toolName === 'write_chapter') {
    const preview = extractStreamingToolPreview(props.rawArguments)
    return [
      preview.chapter,
      preview.preview,
      preview.wordCount > 0 ? t('story.tool.words', { count: preview.wordCount }) : '',
    ]
      .filter(Boolean)
      .join(' · ')
  }

  // Legacy fallback for tools without config
  if (!args) return ''
  switch (props.toolName) {
    case 'write_chapter': {
      const idx = args.index as number
      const chapter =
        typeof idx === 'number' ? t('story.tool.chapterFormat', { index: idx + 1 }) : ''
      const preview =
        typeof args.content === 'string' ? args.content.slice(0, 30).replace(/\n/g, ' ') : ''
      return [chapter, preview].filter(Boolean).join(' · ')
    }
    case 'plan_chapters': {
      const chapters = args.chapters as Array<{ title: string }> | undefined
      return chapters?.length
        ? `${t('story.tool.chapters', { count: chapters.length })} · ${chapters.map((c) => c.title).join(', ')}`
        : ''
    }
    case 'create_character':
    case 'update_character': {
      const charName = args.name as string | undefined
      const role = args.role as string | undefined
      return `${charName || t('story.drawer.unnamed')}${role ? ` (${role})` : ''}`
    }
    default: {
      const keys = Object.keys(args).slice(0, 3)
      return keys.length ? keys.join(', ') : ''
    }
  }
})

const resultSummary = computed(() => {
  if (props.status === 'cancelled') return { success: false, text: t('story.tool.cancelled') }
  if (!props.result) return null

  // Try config resultPreview first
  if (config.value?.resultPreview) {
    try {
      const parsed = JSON.parse(props.result)
      if (parsed.error) return { success: false, text: parsed.error }
      if (typeof config.value.resultPreview === 'function') {
        const text = config.value.resultPreview(parsed)
        if (text) return { success: true, text }
      } else if (typeof config.value.resultPreview === 'string') {
        return { success: true, text: config.value.resultPreview }
      }
    } catch {
      /* fall through to legacy */
    }
  }

  // Legacy fallback
  try {
    const parsed = JSON.parse(props.result)
    if (parsed.error) return { success: false, text: parsed.error }
    const parts: string[] = []
    if (parsed.count !== undefined) parts.push(t('story.tool.items', { count: parsed.count }))
    if (parsed.wordCount !== undefined)
      parts.push(t('story.tool.words', { count: parsed.wordCount }))
    if (parsed.title) parts.push(parsed.title)
    if (parsed.index !== undefined && props.toolName !== 'write_chapter')
      parts.push(t('story.tool.chapterFormat', { index: parsed.index + 1 }))
    if (
      typeof parsed.name === 'string' &&
      props.toolName !== 'create_character' &&
      props.toolName !== 'update_character'
    )
      parts.push(parsed.name)
    return { success: true, text: parts.join(' · ') || t('story.tool.success') }
  } catch {
    return null
  }
})

// ── Expand section data ──────────────────────────────

const hasDetail = computed(
  () =>
    !!props.rawArguments ||
    (props.parsedArguments && Object.keys(props.parsedArguments).length > 0) ||
    !!props.result,
)

const parsedResult = computed<Record<string, unknown> | null>(() => {
  if (!props.result) return null
  try {
    const v = normalizeJsonValue(JSON.parse(props.result))
    return v && typeof v === 'object' ? (v as Record<string, unknown>) : null
  } catch {
    return null
  }
})

// ── Visual helpers ───────────────────────────────────

const cardClass = computed(() => {
  if (props.status === 'error' || resultSummary.value?.success === false) {
    return 'border-red-200/30 dark:border-red-800/30'
  }
  if (props.status === 'cancelled') {
    return 'opacity-70'
  }
  return ''
})

const textClass = computed(() => {
  if (props.status === 'error' || resultSummary.value?.success === false) {
    return 'text-destructive'
  }
  if (props.status === 'cancelled') {
    return 'text-amber-600 dark:text-amber-400'
  }
  return 'text-muted-foreground hover:text-foreground'
})

const toolIconComp = computed(() => {
  switch (props.toolName) {
    case 'write_chapter':
      return PenLine
    case 'plan_chapters':
      return ListOrdered
    case 'create_character':
      return UserPlus
    case 'update_character':
      return UserPen
    default:
      return null
  }
})

const statusIconComp = computed(() => {
  switch (props.status) {
    case 'pending':
      return Loader2
    case 'completed':
      return CheckCircle2
    case 'cancelled':
      return MinusCircle
    case 'error':
      return XCircle
    default:
      return XCircle
  }
})

const statusColor = computed(() => {
  switch (props.status) {
    case 'pending':
      return 'text-blue-500'
    case 'completed':
      return 'text-emerald-500'
    case 'cancelled':
      return 'text-amber-500 dark:text-amber-400'
    case 'error':
      return 'text-destructive'
    default:
      return ''
  }
})

const statusText = computed(() => {
  switch (props.status) {
    case 'pending':
      return t('story.tool.executing')
    case 'cancelled':
      return t('story.tool.cancelled')
    case 'error':
      return resultSummary.value?.text || t('story.tool.error')
    default:
      return ''
  }
})

const headerSummary = computed(() => {
  if (props.status === 'completed') {
    return resultSummary.value?.text || argSummary.value || ''
  }
  if (props.status === 'pending' && argSummary.value) {
    return argSummary.value
  }
  return ''
})

defineExpose({ safeStringify: (v: unknown) => JSON.stringify(normalizeJsonValue(v), null, 2) })
</script>

<template>
  <div class="w-full">
    <div
      class="w-full rounded-lg border bg-card shadow-sm text-xs transition-colors duration-200 overflow-x-auto tool-card-scroll"
      :class="cardClass"
    >
      <!-- ── Interactive header (has detail to expand) ── -->
      <button
        v-if="hasDetail"
        class="w-full flex items-center gap-2 px-3.5 py-2.5 hover:bg-muted/20 transition-colors duration-150 rounded-lg cursor-pointer select-none"
        :class="textClass"
        @click="toggle"
      >
        <component :is="toolIconComp" v-if="toolIconComp" class="size-3.5 shrink-0" />
        <span v-else class="shrink-0 text-xs leading-none">{{ info.icon }}</span>

        <span class="font-medium shrink-0">{{ info.displayName }}</span>

        <span v-if="headerSummary" class="truncate opacity-60 min-w-0">{{ headerSummary }}</span>
        <span v-else-if="statusText" class="truncate opacity-60 min-w-0">{{ statusText }}</span>

        <span class="flex-1" />

        <span class="flex items-center gap-1 shrink-0" :class="statusColor">
          <component
            :is="statusIconComp"
            class="size-3 shrink-0"
            :class="{ 'animate-spin': props.status === 'pending' }"
          />
          <span v-if="statusText && headerSummary" class="sr-only">{{ statusText }}</span>
          <span v-else-if="statusText && !headerSummary" class="hidden sm:inline">{{
            statusText
          }}</span>
        </span>

        <ChevronDown
          class="size-3 shrink-0 opacity-40 transition-transform duration-200"
          :class="expanded ? 'rotate-180' : ''"
        />
      </button>

      <!-- ── Non-interactive header (no detail) ── -->
      <div v-else class="flex items-center gap-2 px-3.5 py-2.5" :class="textClass">
        <component :is="toolIconComp" v-if="toolIconComp" class="size-3.5 shrink-0" />
        <span v-else class="shrink-0 text-xs leading-none">{{ info.icon }}</span>

        <span class="font-medium shrink-0">{{ info.displayName }}</span>

        <span v-if="headerSummary" class="truncate opacity-60 min-w-0">{{ headerSummary }}</span>

        <span class="flex-1" />

        <span class="flex items-center gap-1 shrink-0" :class="statusColor">
          <component
            :is="statusIconComp"
            class="size-3 shrink-0"
            :class="{ 'animate-spin': props.status === 'pending' }"
          />
          <span v-if="statusText && !headerSummary" class="hidden sm:inline">{{ statusText }}</span>
        </span>
      </div>

      <!-- ── Expandable detail section ── -->
      <div
        v-show="expanded && hasDetail"
        class="border-t transition-all duration-200 ease-out"
        :class="
          expanded && hasDetail
            ? 'max-h-96 opacity-100 overflow-y-auto tool-detail-scroll'
            : 'max-h-0 opacity-0 overflow-hidden border-transparent'
        "
      >
        <div class="px-3.5 py-2.5 space-y-3">
          <!-- ── Arguments ── -->

          <!-- Human-readable arguments (from config) -->
          <div v-if="hasArgConfig">
            <div class="text-muted-foreground/40 mb-1.5 font-medium text-xs">
              {{ t('story.tool.parameters') }}
            </div>
            <div class="bg-muted/40 rounded-lg p-2.5">
              <ToolFieldRenderer :fields="config!.argFields!" :data="parsedArguments!" />
            </div>
          </div>
          <!-- Legacy JSON arguments (no config or no parsed data) -->
          <div v-else-if="parsedArguments && Object.keys(parsedArguments).length > 0">
            <div class="text-muted-foreground/40 mb-1.5 font-medium text-xs">
              {{ t('story.tool.parameters') }}
            </div>
            <div class="bg-muted/40 rounded-lg p-2.5">
              <JsonTreeViewer
                :data="parsedArguments"
                :root-key="toolName"
                :max-depth="2"
                :collapsed-node-length="5"
              />
            </div>
          </div>
          <div v-else-if="rawArguments">
            <div class="text-muted-foreground/40 mb-1.5 font-medium text-xs">
              {{ t('story.tool.parameters') }}
            </div>
            <pre
              class="bg-muted/40 rounded-lg p-2.5 font-mono text-muted-foreground/70 whitespace-pre-wrap break-all overflow-x-auto"
              >{{ rawArguments }}</pre
            >
          </div>

          <!-- ── Result ── -->

          <!-- Human-readable result (from config) -->
          <div v-if="hasResultConfig">
            <div class="text-muted-foreground/40 mb-1.5 font-medium text-xs">
              {{ t('story.tool.result') }}
            </div>
            <div class="bg-muted/40 rounded-lg p-2.5">
              <ToolFieldRenderer :fields="config!.resultFields!" :data="parsedResult!" />
            </div>
          </div>
          <!-- Legacy JSON result (no config) -->
          <div v-else-if="parsedResult !== null">
            <div class="text-muted-foreground/40 mb-1.5 font-medium text-xs">
              {{ t('story.tool.result') }}
            </div>
            <div class="bg-muted/40 rounded-lg p-2.5">
              <JsonTreeViewer
                :data="parsedResult"
                :root-key="toolName"
                :max-depth="2"
                :collapsed-node-length="5"
              />
            </div>
          </div>
          <div v-else-if="result">
            <div class="text-muted-foreground/40 mb-1.5 font-medium text-xs">
              {{ t('story.tool.result') }}
            </div>
            <pre
              class="bg-muted/40 rounded-lg p-2.5 font-mono text-muted-foreground/70 whitespace-pre-wrap break-all overflow-x-auto"
              >{{ result }}</pre
            >
          </div>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.tool-detail-scroll::-webkit-scrollbar {
  width: 5px;
}
.tool-detail-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.tool-detail-scroll::-webkit-scrollbar-thumb {
  background: oklch(0.922 0 0);
  border-radius: 3px;
}
.tool-detail-scroll::-webkit-scrollbar-thumb:hover {
  background: oklch(0.87 0 0);
}
.dark .tool-detail-scroll::-webkit-scrollbar-thumb {
  background: oklch(0.269 0 0);
}
.dark .tool-detail-scroll::-webkit-scrollbar-thumb:hover {
  background: oklch(0.371 0 0);
}

.tool-card-scroll::-webkit-scrollbar {
  height: 4px;
}
.tool-card-scroll::-webkit-scrollbar-track {
  background: transparent;
}
.tool-card-scroll::-webkit-scrollbar-thumb {
  background: oklch(0.922 0 0);
  border-radius: 2px;
}
.tool-card-scroll::-webkit-scrollbar-thumb:hover {
  background: oklch(0.87 0 0);
}
.dark .tool-card-scroll::-webkit-scrollbar-thumb {
  background: oklch(0.269 0 0);
}
.dark .tool-card-scroll::-webkit-scrollbar-thumb:hover {
  background: oklch(0.371 0 0);
}
</style>
