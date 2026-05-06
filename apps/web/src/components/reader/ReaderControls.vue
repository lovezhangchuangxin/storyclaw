<script setup lang="ts">
import { inject, type Ref } from 'vue'
import { useI18n } from 'vue-i18n'
import { BookOpen, ScrollText } from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import type { ReaderSettings } from './types'
import type { AppTheme } from '@/db/types'

const { t } = useI18n()

const themes: { id: AppTheme; name: string; bg: string }[] = [
  { id: 'light', name: t('settings.appearance.theme.light'), bg: '#FCFAF7' },
  { id: 'dark', name: t('settings.appearance.theme.dark'), bg: '#1A1A1E' },
  { id: 'parchment', name: t('settings.appearance.theme.parchment'), bg: '#F4E4C1' },
  { id: 'frost', name: t('settings.appearance.theme.frost'), bg: '#F0F4FA' },
  { id: 'peach', name: t('settings.appearance.theme.peach'), bg: '#FBEDE8' },
  { id: 'pine', name: t('settings.appearance.theme.pine'), bg: '#EAF0E7' },
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

function updateSetting<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
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
        <p class="text-xs font-medium text-muted-foreground mb-2.5">
          {{ $t('settings.appearance.theme.label') }}
        </p>
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
                :class="
                  appTheme === t.id
                    ? 'ring-foreground/70 scale-[1.12]'
                    : 'ring-transparent group-hover:ring-muted-foreground/25 group-hover:scale-105'
                "
              />
            </span>
            <span
              class="text-[10px] leading-none transition-colors"
              :class="
                appTheme === t.id ? 'text-foreground font-medium' : 'text-muted-foreground/70'
              "
            >
              {{ t.name }}
            </span>
          </button>
        </div>
      </div>

      <!-- Scroll mode -->
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-2.5">
          {{ $t('settings.appearance.scrollMode.label') }}
        </p>
        <div class="grid grid-cols-2 gap-2">
          <button
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-all duration-200"
            :class="
              settings.scrollMode === 'scroll'
                ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/30'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
            "
            @click="updateSetting('scrollMode', 'scroll')"
          >
            <ScrollText class="size-3.5" />
            {{ $t('settings.appearance.scrollMode.scroll') }}
          </button>
          <button
            class="flex items-center justify-center gap-1.5 rounded-lg py-2 text-xs transition-all duration-200"
            :class="
              settings.scrollMode === 'paged'
                ? 'bg-primary/10 text-primary font-medium ring-1 ring-primary/30'
                : 'bg-muted/50 text-muted-foreground hover:bg-muted/80'
            "
            @click="updateSetting('scrollMode', 'paged')"
          >
            <BookOpen class="size-3.5" />
            {{ $t('settings.appearance.scrollMode.paged') }}
          </button>
        </div>
      </div>

      <!-- Font size -->
      <div>
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-xs font-medium text-muted-foreground">
            {{ $t('settings.appearance.typography.fontSize') }}
          </p>
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
          <p class="text-xs font-medium text-muted-foreground">
            {{ $t('settings.appearance.typography.lineHeight') }}
          </p>
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
          <p class="text-xs font-medium text-muted-foreground">
            {{ $t('settings.appearance.typography.paragraphSpacing') }}
          </p>
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
