<script setup lang="ts">
import { List, Palette, Type, ChevronUp } from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { PRESET_THEMES, FONT_OPTIONS } from './types'
import type { ReaderSettings } from './types'

const props = defineProps<{
  settings: ReaderSettings
  chapterIndex: number
  totalChapters: number
}>()

const emit = defineEmits<{
  'update:settings': [settings: ReaderSettings]
  openChapters: []
  close: []
}>()

function updateSetting<K extends keyof ReaderSettings>(key: K, value: ReaderSettings[K]) {
  emit('update:settings', { ...props.settings, [key]: value })
}

function applyTheme(themeId: string) {
  const theme = PRESET_THEMES.find((t) => t.id === themeId)
  if (theme) {
    emit('update:settings', {
      ...props.settings,
      backgroundColor: theme.backgroundColor,
      textColor: theme.textColor,
    })
  }
}
</script>

<template>
  <div class="border-t bg-background rounded-t-xl shadow-lg">
    <!-- Handle bar -->
    <div class="flex justify-center pt-2 pb-1">
      <button class="size-8 flex items-center justify-center" @click="emit('close')">
        <ChevronUp class="size-4 text-muted-foreground" />
      </button>
    </div>

    <!-- Chapter info row -->
    <div class="flex items-center justify-between px-4 pb-2">
      <button
        class="flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground"
        @click="emit('openChapters')"
      >
        <List class="size-4" />
        目录 {{ chapterIndex + 1 }}/{{ totalChapters }}
      </button>
    </div>

    <div class="px-4 pb-4 space-y-3">
      <!-- Theme -->
      <div class="flex items-center gap-3">
        <Palette class="size-4 text-muted-foreground shrink-0" />
        <div class="flex gap-2 overflow-x-auto flex-1">
          <button
            v-for="t in PRESET_THEMES"
            :key="t.id"
            class="size-7 rounded-full border-2 shrink-0 transition-transform"
            :class="
              settings.backgroundColor === t.backgroundColor
                ? 'scale-110 border-primary'
                : 'border-border'
            "
            :style="{ backgroundColor: t.backgroundColor }"
            :title="t.name"
            @click="applyTheme(t.id)"
          />
        </div>
      </div>

      <!-- Font family -->
      <div class="flex items-center gap-3">
        <Type class="size-4 text-muted-foreground shrink-0" />
        <Select
          :model-value="settings.fontFamily"
          @update:model-value="
            (v) => {
              if (v) updateSetting('fontFamily', String(v))
            }
          "
        >
          <SelectTrigger class="h-8 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="f in FONT_OPTIONS" :key="f.value" :value="f.value">
              {{ f.label }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>

      <!-- Font size -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground shrink-0 w-8">字号</span>
        <Slider
          :model-value="[settings.fontSize]"
          :min="12"
          :max="24"
          :step="1"
          class="flex-1"
          @update:model-value="
            (v) => {
              if (v) updateSetting('fontSize', v[0])
            }
          "
        />
        <span class="text-xs text-muted-foreground w-8 text-right">{{ settings.fontSize }}</span>
      </div>

      <!-- Line height -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground shrink-0 w-8">行距</span>
        <Slider
          :model-value="[settings.lineHeight]"
          :min="1.4"
          :max="2.4"
          :step="0.1"
          class="flex-1"
          @update:model-value="
            (v) => {
              if (v) updateSetting('lineHeight', v[0])
            }
          "
        />
        <span class="text-xs text-muted-foreground w-8 text-right">{{ settings.lineHeight }}</span>
      </div>

      <!-- Paragraph spacing -->
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground shrink-0 w-8">段距</span>
        <Slider
          :model-value="[settings.paragraphSpacing]"
          :min="0"
          :max="2"
          :step="0.1"
          class="flex-1"
          @update:model-value="
            (v) => {
              if (v) updateSetting('paragraphSpacing', v[0])
            }
          "
        />
        <span class="text-xs text-muted-foreground w-8 text-right"
          >{{ settings.paragraphSpacing }}em</span
        >
      </div>
    </div>
  </div>
</template>
