<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { Slider } from '@/components/ui/slider'
import type { ReaderSettings } from './types'
import type { AppTheme } from '@/db/types'

const themes: { id: AppTheme; name: string; bg: string }[] = [
  { id: 'light', name: '浅色', bg: '#FCFAF7' },
  { id: 'dark', name: '深色', bg: '#1A1A1E' },
  { id: 'parchment', name: '护眼', bg: '#F4E4C1' },
  { id: 'frost', name: '霜华', bg: '#F0F4FA' },
  { id: 'peach', name: '桃夭', bg: '#FBEDE8' },
  { id: 'pine', name: '松烟', bg: '#EAF0E7' },
]

const props = defineProps<{
  settings: ReaderSettings
  chapterIndex: number
  totalChapters: number
}>()

const emit = defineEmits<{
  'update:settings': [settings: ReaderSettings]
  close: []
}>()

const appTheme = inject<Ref<AppTheme>>('appTheme')
const applyTheme = inject<(theme: AppTheme) => void>('applyTheme')

function updateSetting<K extends keyof ReaderSettings>(
  key: K,
  value: ReaderSettings[K],
) {
  emit('update:settings', { ...props.settings, [key]: value })
}
</script>

<template>
  <div class="border-t bg-background/90 backdrop-blur-sm rounded-t-2xl shadow-lg">
    <!-- Drag handle -->
    <div class="flex justify-center pt-2 pb-1">
      <button
        class="w-10 h-1 rounded-full bg-muted-foreground/20 hover:bg-muted-foreground/30 transition-colors"
        @click="emit('close')"
      />
    </div>

    <div class="px-5 pb-5 space-y-5">
      <!-- Theme -->
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-2.5">主题</p>
        <div class="flex items-center gap-4 overflow-x-auto scrollbar-none">
          <button
            v-for="t in themes"
            :key="t.id"
            class="group flex flex-col items-center gap-1.5 shrink-0 py-0.5"
            :title="t.name"
            @click="applyTheme?.(t.id)"
          >
            <span class="relative">
              <span
                class="block size-9 rounded-full shadow-sm ring-1 ring-black/8 transition-all duration-200"
                :style="{ backgroundColor: t.bg }"
              />
              <span
                class="absolute inset-0 rounded-full ring-2 transition-all duration-200"
                :class="appTheme === t.id
                  ? 'ring-foreground/70 scale-[1.12]'
                  : 'ring-transparent group-hover:ring-muted-foreground/25 group-hover:scale-105'"
              />
            </span>
            <span
              class="text-[10px] leading-none transition-colors"
              :class="appTheme === t.id ? 'text-foreground font-medium' : 'text-muted-foreground/70'"
            >
              {{ t.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- Font size -->
      <div>
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-xs font-medium text-muted-foreground">字号</p>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ settings.fontSize }}px
          </span>
        </div>
        <Slider
          :model-value="[settings.fontSize]"
          :min="12"
          :max="24"
          :step="1"
          @update:model-value="
            (v) => {
              if (v) updateSetting('fontSize', v[0])
            }
          "
        />
      </div>

      <!-- Line height -->
      <div>
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-xs font-medium text-muted-foreground">行距</p>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ settings.lineHeight }}
          </span>
        </div>
        <Slider
          :model-value="[settings.lineHeight]"
          :min="1.4"
          :max="2.4"
          :step="0.1"
          @update:model-value="
            (v) => {
              if (v) updateSetting('lineHeight', v[0])
            }
          "
        />
      </div>

      <!-- Paragraph spacing -->
      <div>
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-xs font-medium text-muted-foreground">段距</p>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ settings.paragraphSpacing }}em
          </span>
        </div>
        <Slider
          :model-value="[settings.paragraphSpacing]"
          :min="0"
          :max="2"
          :step="0.1"
          @update:model-value="
            (v) => {
              if (v) updateSetting('paragraphSpacing', v[0])
            }
          "
        />
      </div>
    </div>
  </div>
</template>

<style scoped>
.scrollbar-none {
  -ms-overflow-style: none;
  scrollbar-width: none;
}
.scrollbar-none::-webkit-scrollbar {
  display: none;
}
</style>
