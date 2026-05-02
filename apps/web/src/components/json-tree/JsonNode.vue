<script setup lang="ts">
import { computed, ref } from 'vue'
import { Copy, Check } from 'lucide-vue-next'
import { getJsonType, isExpandable, stringifyValue } from './utils'
import type { JsonNodeProps } from './types'

const props = defineProps<JsonNodeProps>()

function initialExpanded(): boolean {
  if (props.depth >= props.maxDepth) return false
  const t = getJsonType(props.value)
  if (!isExpandable(t)) return false
  if (t === 'object') {
    return Object.keys(props.value as Record<string, unknown>).length <= props.collapsedNodeLength
  }
  if (t === 'array') {
    return (props.value as unknown[]).length <= props.collapsedNodeLength
  }
  return true
}

const isExpanded = ref(initialExpanded())
const stringExpanded = ref(false)
const copied = ref(false)

const type = computed(() => getJsonType(props.value))

const objKeys = computed(() => {
  if (type.value !== 'object') return []
  const val = props.value as Record<string, unknown>
  return Object.keys(val)
})

const arrLen = computed(() => {
  if (type.value !== 'array') return 0
  return (props.value as unknown[]).length
})

const entries = computed<Array<[string | number, unknown]>>(() => {
  if (type.value === 'object') {
    return Object.entries(props.value as Record<string, unknown>)
  }
  if (type.value === 'array') {
    return (props.value as unknown[]).map((v, i) => [i, v] as [number, unknown])
  }
  return []
})

const childCount = computed(() => {
  if (type.value === 'object') return objKeys.value.length
  if (type.value === 'array') return arrLen.value
  return 0
})

const isCircular = computed(() => {
  if (props.value !== null && typeof props.value === 'object') {
    return props.visited.has(props.value as object)
  }
  return false
})

const valueColorClass = computed(() => {
  switch (type.value) {
    case 'string': return 'text-[var(--jt-string)]'
    case 'number': return 'text-[var(--jt-number)]'
    case 'boolean': return 'text-[var(--jt-boolean)]'
    case 'null': return 'text-[var(--jt-null)]'
    case 'undefined': return 'text-[var(--jt-undefined)]'
    default: return 'text-[var(--jt-null)]'
  }
})

const isLongString = computed(() => {
  if (type.value !== 'string') return false
  return stringifyValue(props.value).length > props.maxStringLength
})

const displayValue = computed(() => {
  const full = stringifyValue(props.value)
  if (type.value === 'string' && !stringExpanded.value && full.length > props.maxStringLength) {
    return `${full.slice(0, props.maxStringLength)}…`
  }
  return full
})

function toggle() {
  isExpanded.value = !isExpanded.value
}

function toggleString() {
  stringExpanded.value = !stringExpanded.value
}

async function copyValue() {
  const text = stringifyValue(props.value)
  await navigator.clipboard.writeText(text)
  copied.value = true
  setTimeout(() => {
    copied.value = false
  }, 1500)
}

function formatKey(key: string | number): string {
  if (typeof key === 'number') return `[${key}]`
  return key
}

function buildChildPath(key: string | number): string {
  if (typeof key === 'number') return `${props.path}[${key}]`
  return `${props.path}.${key}`
}

const childVisited = computed(() => {
  const ws = props.visited
  if (props.value !== null && typeof props.value === 'object') {
    ws.add(props.value as object)
  }
  return ws
})

const rowPadding = computed(() => {
  if (props.depth === 0) return undefined
  return { paddingLeft: `${props.depth * 16}px` }
})
</script>

<template>
  <div>
    <!-- Empty object -->
    <template v-if="type === 'object' && objKeys.length === 0">
      <div
        class="flex items-center gap-1 min-h-[28px] md:min-h-[32px]"
        :style="rowPadding"
      >
        <span
          v-if="keyName !== null"
          class="text-[var(--jt-key)] font-medium font-mono text-xs md:text-[13px]"
        >{{ formatKey(keyName) }}: </span>
        <span class="text-[var(--jt-bracket)] font-mono text-xs">{}</span>
      </div>
    </template>

    <!-- Empty array -->
    <template v-else-if="type === 'array' && arrLen === 0">
      <div
        class="flex items-center gap-1 min-h-[28px] md:min-h-[32px]"
        :style="rowPadding"
      >
        <span
          v-if="keyName !== null"
          class="text-[var(--jt-key)] font-medium font-mono text-xs md:text-[13px]"
        >{{ formatKey(keyName) }}: </span>
        <span class="text-[var(--jt-bracket)] font-mono text-xs">[]</span>
      </div>
    </template>

    <!-- Circular reference -->
    <template v-else-if="isCircular">
      <div
        class="flex items-center gap-1 min-h-[28px] md:min-h-[32px]"
        :style="rowPadding"
      >
        <span
          v-if="keyName !== null"
          class="text-[var(--jt-key)] font-medium font-mono text-xs md:text-[13px]"
        >{{ formatKey(keyName) }}: </span>
        <span class="text-[var(--jt-null)] font-mono text-xs">[Circular]</span>
      </div>
    </template>

    <!-- Max depth -->
    <template v-else-if="depth >= maxRenderDepth">
      <div
        class="flex items-center gap-1 min-h-[28px] md:min-h-[32px]"
        :style="rowPadding"
      >
        <span
          v-if="keyName !== null"
          class="text-[var(--jt-key)] font-medium font-mono text-xs md:text-[13px]"
        >{{ formatKey(keyName) }}: </span>
        <span class="text-muted-foreground font-mono text-xs">[Max depth]</span>
      </div>
    </template>

    <!-- Expandable: object or array with items -->
    <template v-else-if="isExpandable(type)">
      <button
        class="flex items-center gap-1 w-full text-left min-h-[28px] md:min-h-[32px] hover:bg-[var(--jt-bg-hover)] transition-colors duration-150 cursor-pointer select-none"
        :style="rowPadding"
        @click="toggle"
      >
        <span class="text-[10px] w-3 text-center text-[var(--jt-bracket)] shrink-0 select-none transition-transform duration-200 ease-out">
          {{ isExpanded ? '▼' : '▶' }}
        </span>
        <span
          v-if="keyName !== null"
          class="text-[var(--jt-key)] font-medium font-mono text-xs md:text-[13px]"
        >{{ formatKey(keyName) }}: </span>
        <span
          v-if="!isExpanded"
          class="text-[var(--jt-bracket)] font-mono text-xs"
        >
          {{ type === 'array' ? `[${childCount} items]` : `{${childCount} keys}` }}
        </span>
        <span
          v-else
          class="text-[var(--jt-bracket)] font-mono text-xs"
        >
          {{ type === 'array' ? '[' : '{' }}
        </span>
      </button>

      <div
        v-show="isExpanded"
        class="pl-[16px] border-l border-[var(--jt-guide)] ml-[11px]"
      >
        <JsonNode
          v-for="[k, val] in entries"
          :key="String(k)"
          :key-name="k"
          :value="val"
          :depth="depth + 1"
          :path="buildChildPath(k)"
          :max-depth="maxDepth"
          :max-render-depth="maxRenderDepth"
          :collapsed-node-length="collapsedNodeLength"
          :max-string-length="maxStringLength"
          :show-copy="showCopy"
          :visited="childVisited"
        />
      </div>
      <!-- Closing bracket aligns with the toggle button row (same rowPadding) -->
      <div
        v-show="isExpanded"
        :style="rowPadding"
        class="text-[var(--jt-bracket)] font-mono text-xs"
      >
        {{ type === 'array' ? ']' : '}' }}
      </div>
    </template>

    <!-- Primitive leaf -->
    <template v-else>
      <div
        class="flex items-center gap-1 group min-h-[28px] md:min-h-[32px]"
        :style="rowPadding"
      >
        <span
          v-if="keyName !== null"
          class="text-[var(--jt-key)] font-medium font-mono text-xs md:text-[13px]"
        >{{ formatKey(keyName) }}: </span>
        <span :class="[valueColorClass, type === 'string' ? 'break-all' : '']" class="font-mono text-xs">{{ displayValue }}</span>
        <button
          v-if="isLongString"
          class="text-[var(--jt-bracket)] font-mono text-xs cursor-pointer hover:text-[var(--jt-key)] transition-colors select-none shrink-0"
          @click="toggleString"
        >
          {{ stringExpanded ? '收起' : '展开' }}
        </button>
        <button
          v-if="showCopy"
          class="opacity-30 hover:opacity-100 transition-opacity ml-1 size-3 shrink-0 cursor-pointer"
          @click="copyValue"
        >
          <component :is="copied ? Check : Copy" class="size-3" :class="copied ? 'text-emerald-500' : ''" />
        </button>
      </div>
    </template>
  </div>
</template>
