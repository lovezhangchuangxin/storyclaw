<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'

const props = withDefaults(
  defineProps<{
    usedTokens: number
    contextWindowTokens: number
    outputReserveTokens: number
    compactionTriggerRatio: number
    messageCount: number
    isEstimated: boolean
  }>(),
  {
    usedTokens: 0,
    contextWindowTokens: 0,
    outputReserveTokens: 0,
    compactionTriggerRatio: 0.7,
    messageCount: 0,
    isEstimated: false,
  },
)

const { t } = useI18n()

const RADIUS = 9
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

const budget = computed(() => props.contextWindowTokens - props.outputReserveTokens)
const ratio = computed(() => (budget.value > 0 ? Math.min(props.usedTokens / budget.value, 1) : 0))
const dashOffset = computed(() => CIRCUMFERENCE * (1 - ratio.value))
const percentage = computed(() => Math.round(ratio.value * 100))
const triggerThreshold = computed(() => Math.floor(budget.value * props.compactionTriggerRatio))
const remaining = computed(() => Math.max(0, budget.value - props.usedTokens))

const isAvailable = computed(() => props.contextWindowTokens > 0)

const ringColor = computed(() => {
  if (ratio.value >= props.compactionTriggerRatio) return 'text-red-500'
  if (ratio.value >= 0.5) return 'text-amber-500'
  return 'text-emerald-500'
})

const barColor = computed(() => {
  if (ratio.value >= props.compactionTriggerRatio) return 'bg-red-500'
  if (ratio.value >= 0.5) return 'bg-amber-500'
  return 'bg-emerald-500'
})
</script>

<template>
  <Popover v-if="isAvailable">
    <PopoverTrigger as-child>
      <button
        class="flex items-center justify-center rounded-md p-1.5"
        :aria-label="t('story.agent.contextInfo.label')"
      >
        <svg viewBox="0 0 24 24" class="size-6" fill="none">
          <circle
            cx="12"
            cy="12"
            :r="RADIUS"
            stroke="currentColor"
            stroke-width="2.5"
            class="text-muted-foreground/25"
          />
          <circle
            cx="12"
            cy="12"
            :r="RADIUS"
            stroke="currentColor"
            stroke-width="2.5"
            stroke-linecap="round"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="dashOffset"
            transform="rotate(-90 12 12)"
            :class="ringColor"
            class="transition-[stroke-dashoffset] duration-500"
          />
        </svg>
      </button>
    </PopoverTrigger>
    <PopoverContent align="end" side="top" class="w-60 p-3">
      <div class="space-y-3">
        <div class="text-xs font-medium">{{ t('story.agent.contextInfo.title') }}</div>

        <div>
          <div class="mb-1 flex items-center justify-between text-xs">
            <span class="text-muted-foreground">{{ t('story.agent.contextInfo.usage') }}</span>
            <span :class="ringColor" class="font-medium tabular-nums">{{ percentage }}%</span>
          </div>
          <div class="h-1.5 overflow-hidden rounded-full bg-muted">
            <div
              :class="barColor"
              class="h-full rounded-full transition-all duration-500"
              :style="{ width: `${Math.min(ratio * 100, 100)}%` }"
            />
          </div>
        </div>

        <div class="space-y-1.5 text-xs">
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">
              {{ t('story.agent.contextInfo.used') }}
              <span v-if="isEstimated" class="text-muted-foreground/60"
                >({{ t('story.agent.contextInfo.estimated') }})</span
              >
            </span>
            <span class="tabular-nums">{{ usedTokens.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{ t('story.agent.contextInfo.windowSize') }}</span>
            <span class="tabular-nums">{{ contextWindowTokens.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{
              t('story.agent.contextInfo.outputReserve')
            }}</span>
            <span class="tabular-nums">{{ outputReserveTokens.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{ t('story.agent.contextInfo.available') }}</span>
            <span class="tabular-nums">{{ remaining.toLocaleString() }}</span>
          </div>
          <div class="flex justify-between gap-4">
            <span class="text-muted-foreground">{{ t('story.agent.contextInfo.messages') }}</span>
            <span class="tabular-nums">{{ messageCount }}</span>
          </div>
        </div>

        <div class="border-t pt-2 text-[11px] text-muted-foreground">
          {{
            t('story.agent.contextInfo.triggerAt', {
              percent: Math.round(compactionTriggerRatio * 100),
            })
          }}
          <span class="font-medium tabular-nums">{{ triggerThreshold.toLocaleString() }}</span>
        </div>
      </div>
    </PopoverContent>
  </Popover>
</template>
