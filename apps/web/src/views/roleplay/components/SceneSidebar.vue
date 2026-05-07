<script setup lang="ts">
import { ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown } from 'lucide-vue-next'
import type { RoleplaySidebarData } from '@/db/roleplay-types'

defineProps<{
  data: RoleplaySidebarData | null
}>()

const { t } = useI18n()
const collapsedGroups = ref<Set<string>>(new Set())

function toggleGroup(id: string) {
  const next = new Set(collapsedGroups.value)
  if (next.has(id)) {
    next.delete(id)
  } else {
    next.add(id)
  }
  collapsedGroups.value = next
}
</script>

<template>
  <div class="flex h-full flex-col">
    <div class="shrink-0 px-3 py-2 border-b">
      <h3 class="text-xs font-medium text-muted-foreground uppercase tracking-wider">
        {{ t('roleplay.sidebar.title') }}
      </h3>
    </div>

    <div v-if="!data || data.groups.length === 0" class="flex-1 flex items-center justify-center">
      <p class="text-xs text-muted-foreground/50">{{ t('roleplay.sidebar.empty') }}</p>
    </div>

    <div v-else class="flex-1 overflow-y-auto p-2 space-y-1.5">
      <div
        v-for="group in data.groups"
        :key="group.id"
        class="rounded-lg border bg-card overflow-hidden"
      >
        <button
          class="w-full flex items-center gap-2 px-3 py-2 text-left text-sm font-medium hover:bg-muted/50 transition-colors"
          @click="toggleGroup(group.id)"
        >
          <ChevronDown
            class="size-3.5 shrink-0 text-muted-foreground transition-transform"
            :class="{ '-rotate-90': collapsedGroups.has(group.id) }"
          />
          <span class="truncate">{{ group.title }}</span>
        </button>
        <div v-if="!collapsedGroups.has(group.id)" class="px-3 pb-2 space-y-1.5">
          <div
            v-for="field in group.fields"
            :key="field.key"
            class="flex items-start gap-2 text-xs"
          >
            <span class="shrink-0 text-muted-foreground min-w-[4em]">{{ field.label }}</span>
            <span
              v-if="field.type === 'badge'"
              class="inline-flex rounded-full bg-primary/10 px-2 py-0.5 text-primary text-[11px]"
            >
              {{ field.value }}
            </span>
            <span v-else class="text-foreground break-all">{{ field.value || '—' }}</span>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
