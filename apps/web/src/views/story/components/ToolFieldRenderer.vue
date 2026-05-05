<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import type { FieldDisplay } from '@/agent/tools/display-config'
import { getField } from '@/agent/tools/display-config'
import { ChevronDown, ChevronUp } from 'lucide-vue-next'

const { t } = useI18n()

const props = defineProps<{
  fields: FieldDisplay[]
  data: Record<string, unknown>
}>()

const multilineExpandLimit = 200

// Track expanded state for each multiline field
const expandedFields = ref<Set<string>>(new Set())

function toggleMultiline(key: string) {
  const next = new Set(expandedFields.value)
  if (next.has(key)) next.delete(key)
  else next.add(key)
  expandedFields.value = next
}

function resolveValue(field: FieldDisplay): { raw: unknown; display: string; exists: boolean } {
  const raw = getField(props.data, field.key)
  const exists = raw !== undefined && raw !== null && raw !== ''
  const display = field.transform ? field.transform(raw) : String(raw ?? '')
  return { raw, display, exists }
}

function badgeColor(raw: unknown): string {
  if (raw === true) return 'badge-green'
  if (raw === false) return 'badge-gray'

  const v = String(raw ?? '')
  const colorMap: Record<string, string> = {
    protagonist: 'badge-blue',
    antagonist: 'badge-red',
    supporting: 'badge-green',
    minor: 'badge-gray',
    'first-person': 'badge-blue',
    'third-person-limited': 'badge-green',
    'third-person-omniscient': 'badge-purple',
    past: 'badge-orange',
    present: 'badge-teal',
    drafting: 'badge-yellow',
    completed: 'badge-green',
    editing: 'badge-blue',
    abandoned: 'badge-gray',
    planned: 'badge-blue',
  }
  return colorMap[v] ?? 'badge-gray'
}

// Render context helpers
function isLongText(text: string): boolean {
  return text.length > multilineExpandLimit
}
</script>

<template>
  <div class="field-renderer space-y-2">
    <template v-for="field in fields" :key="field.key">
      <template v-if="field.type !== 'hidden'">
        <div v-if="resolveValue(field).exists" class="field-row">
          <span class="field-label">{{ $t(field.label) }}</span>

          <!-- text: inline label + value -->
          <span v-if="field.type === 'text'" class="field-value">
            {{ resolveValue(field).display }}
          </span>

          <!-- badge: colored capsule -->
          <span
            v-else-if="field.type === 'badge'"
            :class="['badge-capsule', badgeColor(resolveValue(field).raw)]"
          >
            {{ resolveValue(field).display }}
          </span>

          <!-- multiline: paragraph block with expand -->
          <div v-else-if="field.type === 'multiline'" class="field-multiline-block">
            <div
              :class="{
                'line-clamp-6':
                  isLongText(resolveValue(field).display) && !expandedFields.has(field.key),
              }"
              class="multiline-text whitespace-pre-wrap break-words"
            >
              {{ resolveValue(field).display }}
            </div>
            <button
              v-if="isLongText(resolveValue(field).display)"
              class="expand-toggle"
              @click="toggleMultiline(field.key)"
            >
              {{
                expandedFields.has(field.key)
                  ? t('story.drawer.collapse')
                  : t('story.drawer.expandAll')
              }}
              <component
                :is="expandedFields.has(field.key) ? ChevronUp : ChevronDown"
                class="size-3"
              />
            </button>
          </div>

          <!-- list: bullet points -->
          <div v-else-if="field.type === 'list'" class="field-list-block">
            <div
              v-for="(item, i) in resolveValue(field).display.split('\n').filter(Boolean)"
              :key="i"
              class="list-item"
            >
              <span class="list-bullet">•</span>
              <span class="list-text">{{ item }}</span>
            </div>
          </div>

          <!-- tags: inline chips -->
          <div v-else-if="field.type === 'tags'" class="field-tags-block">
            <span
              v-for="(tag, i) in resolveValue(field)
                .display.split(',')
                .map((t) => t.trim())
                .filter(Boolean)"
              :key="i"
              class="tag-chip"
            >
              {{ tag }}
            </span>
          </div>
        </div>
      </template>
    </template>

    <!-- Empty state -->
    <div
      v-if="
        !fields.some(
          (f) =>
            f.type !== 'hidden' &&
            getField(data, f.key) !== undefined &&
            getField(data, f.key) !== null &&
            getField(data, f.key) !== '',
        )
      "
      class="field-empty"
    >
      {{ t('common.noFieldData') }}
    </div>
  </div>
</template>

<style scoped>
.field-renderer {
  font-size: 12.5px;
  line-height: 1.6;
}

.field-row {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.field-label {
  font-size: 11px;
  font-weight: 500;
  color: oklch(0.52 0 0);
}

.dark .field-label {
  color: oklch(0.6 0 0);
}

/* text type */
.field-value {
  color: oklch(0.35 0 0);
}

.dark .field-value {
  color: oklch(0.85 0 0);
}

/* badge type */
.badge-capsule {
  display: inline-flex;
  align-items: center;
  padding: 2px 8px;
  border-radius: 5px;
  font-size: 11px;
  font-weight: 500;
  width: fit-content;
  line-height: 1.5;
}

.badge-blue {
  background: oklch(0.93 0.03 240);
  color: oklch(0.35 0.12 250);
}
.badge-red {
  background: oklch(0.93 0.05 25);
  color: oklch(0.45 0.15 25);
}
.badge-green {
  background: oklch(0.93 0.05 150);
  color: oklch(0.35 0.12 150);
}
.badge-gray {
  background: oklch(0.93 0 0);
  color: oklch(0.45 0 0);
}
.badge-purple {
  background: oklch(0.92 0.05 290);
  color: oklch(0.4 0.14 290);
}
.badge-orange {
  background: oklch(0.93 0.06 70);
  color: oklch(0.45 0.14 70);
}
.badge-teal {
  background: oklch(0.92 0.04 190);
  color: oklch(0.35 0.1 190);
}
.badge-yellow {
  background: oklch(0.95 0.06 100);
  color: oklch(0.4 0.12 100);
}

.dark .badge-blue {
  background: oklch(0.25 0.08 250);
  color: oklch(0.8 0.06 240);
}
.dark .badge-red {
  background: oklch(0.3 0.1 25);
  color: oklch(0.85 0.08 25);
}
.dark .badge-green {
  background: oklch(0.25 0.08 150);
  color: oklch(0.8 0.06 150);
}
.dark .badge-gray {
  background: oklch(0.3 0 0);
  color: oklch(0.7 0 0);
}
.dark .badge-purple {
  background: oklch(0.25 0.08 290);
  color: oklch(0.8 0.06 290);
}
.dark .badge-orange {
  background: oklch(0.28 0.08 70);
  color: oklch(0.8 0.06 70);
}
.dark .badge-teal {
  background: oklch(0.25 0.06 190);
  color: oklch(0.8 0.05 190);
}
.dark .badge-yellow {
  background: oklch(0.3 0.06 100);
  color: oklch(0.85 0.05 100);
}

/* multiline type */
.field-multiline-block {
  background: oklch(0.97 0 0);
  border-radius: 4px;
  padding: 8px 10px;
}

.dark .field-multiline-block {
  background: oklch(0.22 0 0);
}

.multiline-text {
  font-size: 12px;
  line-height: 1.65;
  color: oklch(0.4 0 0);
}

.dark .multiline-text {
  color: oklch(0.8 0 0);
}

.line-clamp-6 {
  display: -webkit-box;
  -webkit-line-clamp: 6;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.expand-toggle {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  margin-top: 4px;
  font-size: 11px;
  color: oklch(0.5 0.08 240);
  cursor: pointer;
  background: none;
  border: none;
  padding: 0;
}

.expand-toggle:hover {
  color: oklch(0.4 0.12 240);
}

.dark .expand-toggle {
  color: oklch(0.7 0.06 240);
}

.dark .expand-toggle:hover {
  color: oklch(0.85 0.08 240);
}

/* list type */
.field-list-block {
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.list-item {
  display: flex;
  gap: 6px;
  align-items: flex-start;
}

.list-bullet {
  color: oklch(0.6 0 0);
  flex-shrink: 0;
  font-size: 12px;
  line-height: 1.6;
}

.list-text {
  color: oklch(0.4 0 0);
  line-height: 1.6;
  white-space: pre-wrap;
  word-break: break-word;
}

.dark .list-bullet {
  color: oklch(0.65 0 0);
}

.dark .list-text {
  color: oklch(0.8 0 0);
}

/* tags type */
.field-tags-block {
  display: flex;
  flex-wrap: wrap;
  gap: 3px;
}

.tag-chip {
  display: inline-flex;
  align-items: center;
  padding: 2px 7px;
  border-radius: 3px;
  font-size: 11px;
  background: oklch(0.94 0.02 250);
  color: oklch(0.45 0.06 250);
  border: 1px solid oklch(0.88 0.02 250);
}

.dark .tag-chip {
  background: oklch(0.23 0.04 250);
  color: oklch(0.78 0.04 250);
  border-color: oklch(0.28 0.04 250);
}

/* empty state */
.field-empty {
  font-size: 11px;
  color: oklch(0.55 0 0);
  text-align: center;
  padding: 8px 0;
}
</style>
