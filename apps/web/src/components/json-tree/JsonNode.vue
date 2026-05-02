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
    case 'date': return 'text-[var(--jt-date)]'
    case 'regexp': return 'text-[var(--jt-regexp)]'
    case 'function': return 'text-[var(--jt-function)]'
    case 'bigint': return 'text-[var(--jt-number)]'
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

const indentStyle = computed(() => {
  if (props.depth === 0) return undefined
  return { paddingLeft: `${props.depth * 20}px` }
})
</script>

<template>
  <div>
    <!-- Empty object -->
    <template v-if="type === 'object' && objKeys.length === 0">
      <div
        class="jt-row"
        :style="indentStyle"
      >
        <span class="jt-arrow-placeholder" />
        <span v-if="keyName !== null" class="jt-key">{{ formatKey(keyName) }}:<span class="jt-colon-space" /></span>
        <span class="jt-bracket">{}</span>
      </div>
    </template>

    <!-- Empty array -->
    <template v-else-if="type === 'array' && arrLen === 0">
      <div
        class="jt-row"
        :style="indentStyle"
      >
        <span class="jt-arrow-placeholder" />
        <span v-if="keyName !== null" class="jt-key">{{ formatKey(keyName) }}:<span class="jt-colon-space" /></span>
        <span class="jt-bracket">[]</span>
      </div>
    </template>

    <!-- Circular reference -->
    <template v-else-if="isCircular">
      <div
        class="jt-row"
        :style="indentStyle"
      >
        <span class="jt-arrow-placeholder" />
        <span v-if="keyName !== null" class="jt-key">{{ formatKey(keyName) }}:<span class="jt-colon-space" /></span>
        <span class="jt-circular">Circular</span>
      </div>
    </template>

    <!-- Max depth -->
    <template v-else-if="depth >= maxRenderDepth">
      <div
        class="jt-row"
        :style="indentStyle"
      >
        <span class="jt-arrow-placeholder" />
        <span v-if="keyName !== null" class="jt-key">{{ formatKey(keyName) }}:<span class="jt-colon-space" /></span>
        <span class="jt-max-depth">···</span>
      </div>
    </template>

    <!-- Expandable: object or array with items -->
    <template v-else-if="isExpandable(type)">
      <button
        class="jt-row jt-expandable"
        :style="indentStyle"
        @click="toggle"
      >
        <span class="jt-arrow" :class="isExpanded && 'jt-arrow-open'">
          <svg width="10" height="10" viewBox="0 0 10 10" fill="currentColor">
            <path d="M3 1.5L7.5 5L3 8.5Z" />
          </svg>
        </span>
        <span v-if="keyName !== null" class="jt-key">{{ formatKey(keyName) }}:<span class="jt-colon-space" /></span>
        <span v-if="!isExpanded" class="jt-count">
          {{ type === 'array' ? childCount : `${childCount} k` }}
        </span>
        <span v-else class="jt-bracket">
          {{ type === 'array' ? '[' : '{' }}
        </span>
      </button>

      <div
        v-show="isExpanded"
        class="jt-children"
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
      <div
        v-show="isExpanded"
        class="jt-row jt-close-bracket"
        :style="indentStyle"
      >
        <span class="jt-arrow-placeholder" />
        <span class="jt-bracket">{{ type === 'array' ? ']' : '}' }}</span>
      </div>
    </template>

    <!-- Primitive leaf -->
    <template v-else>
      <div
        class="jt-row jt-leaf"
        :style="indentStyle"
      >
        <span class="jt-arrow-placeholder" />
        <span v-if="keyName !== null" class="jt-key">{{ formatKey(keyName) }}:<span class="jt-colon-space" /></span>
        <span :class="[valueColorClass, type === 'string' ? 'jt-string-value' : 'jt-value']">{{ displayValue }}</span>
        <button
          v-if="isLongString"
          class="jt-string-toggle"
          @click="toggleString"
        >
          {{ stringExpanded ? '收起' : '展开' }}
        </button>
        <button
          v-if="showCopy"
          class="jt-copy-btn"
          :class="copied && 'jt-copy-done'"
          @click="copyValue"
        >
          <component :is="copied ? Check : Copy" class="size-3" />
        </button>
      </div>
    </template>
  </div>
</template>

<style scoped>
.jt-row {
  display: flex;
  align-items: center;
  gap: 4px;
  min-height: 28px;
  padding-right: 4px;
  border-radius: 4px;
  transition: background-color 0.15s ease;
}
@media (min-width: 768px) {
  .jt-row {
    min-height: 30px;
  }
}

.jt-expandable {
  width: 100%;
  text-align: left;
  cursor: pointer;
  background: none;
  border: none;
  font-family: inherit;
  font-size: inherit;
  color: inherit;
  padding-left: 0;
  outline: none;
}
.jt-expandable:hover {
  background: var(--jt-bg-hover);
}
.jt-expandable:active {
  background: var(--jt-bg-active);
}

.jt-leaf {
  position: relative;
}
.jt-leaf:hover {
  background: var(--jt-bg-hover);
}

/* Arrow chevron */
.jt-arrow {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  flex-shrink: 0;
  color: var(--jt-arrow);
  transition: transform 0.2s cubic-bezier(0.4, 0, 0.2, 1), color 0.15s ease;
}
.jt-expandable:hover .jt-arrow {
  color: var(--jt-arrow-hover);
}
.jt-arrow-open {
  transform: rotate(90deg);
}

/* Placeholder for non-expandable rows (keeps alignment) */
.jt-arrow-placeholder {
  display: inline-block;
  width: 16px;
  flex-shrink: 0;
}

/* Key styling */
.jt-key {
  color: var(--jt-key);
  font-weight: 600;
  font-size: 12px;
  letter-spacing: -0.01em;
  transition: color 0.15s ease;
  white-space: nowrap;
}
@media (min-width: 768px) {
  .jt-key {
    font-size: 13px;
  }
}
.jt-expandable:hover .jt-key,
.jt-leaf:hover .jt-key {
  color: var(--jt-key-hover);
}
.jt-colon-space {
  display: inline;
  margin-right: 4px;
}

/* Bracket & count */
.jt-bracket {
  color: var(--jt-bracket);
  font-size: 12px;
  user-select: none;
}
@media (min-width: 768px) {
  .jt-bracket {
    font-size: 13px;
  }
}
.jt-count {
  display: inline-flex;
  align-items: center;
  color: var(--jt-count);
  font-size: 11px;
  font-weight: 500;
  background: var(--jt-bg);
  padding: 1px 7px;
  border-radius: 10px;
  user-select: none;
  line-height: 1.5;
}

/* Children container with guide line */
.jt-children {
  padding-left: 20px;
  margin-left: 7px;
  border-left: 1.5px solid var(--jt-guide);
  transition: border-color 0.15s ease;
}
.jt-children:hover {
  border-left-color: var(--jt-bg-active);
}

/* Close bracket row */
.jt-close-bracket {
  padding-top: 0;
  padding-bottom: 2px;
}

/* Value styling */
.jt-value {
  font-size: 12px;
  white-space: nowrap;
}
@media (min-width: 768px) {
  .jt-value {
    font-size: 13px;
  }
}
.jt-string-value {
  font-size: 12px;
  word-break: break-all;
  line-height: 1.5;
}
@media (min-width: 768px) {
  .jt-string-value {
    font-size: 13px;
  }
}

/* Special value badges */
.jt-circular {
  color: var(--jt-undefined);
  font-size: 11px;
  font-weight: 500;
  font-style: italic;
  opacity: 0.8;
  user-select: none;
}
.jt-max-depth {
  color: var(--jt-bracket);
  font-size: 11px;
  letter-spacing: 2px;
  user-select: none;
}

/* String toggle button */
.jt-string-toggle {
  display: inline-flex;
  align-items: center;
  color: var(--jt-toggle-text);
  font-size: 11px;
  font-weight: 500;
  background: var(--jt-toggle-bg);
  padding: 1px 8px;
  border-radius: 10px;
  border: none;
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
  flex-shrink: 0;
  line-height: 1.5;
}
.jt-string-toggle:hover {
  background: var(--jt-toggle-hover);
}

/* Copy button */
.jt-copy-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  color: var(--jt-copy);
  background: none;
  border: none;
  cursor: pointer;
  padding: 2px;
  border-radius: 3px;
  opacity: 0;
  transition: opacity 0.15s ease, color 0.15s ease, background 0.15s ease;
  flex-shrink: 0;
  margin-left: 2px;
}
.jt-leaf:hover .jt-copy-btn {
  opacity: 0.5;
}
.jt-copy-btn:hover {
  opacity: 1 !important;
  color: var(--jt-copy-hover);
  background: var(--jt-bg-hover);
}
.jt-copy-done {
  color: oklch(0.527 0.14 163) !important;
  opacity: 1 !important;
}
.dark .jt-copy-done {
  color: oklch(0.765 0.14 163) !important;
}
</style>
