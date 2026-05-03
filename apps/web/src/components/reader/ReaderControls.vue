<script setup lang="ts">
import { List } from 'lucide-vue-next'
import { Slider } from '@/components/ui/slider'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FONT_OPTIONS } from './types'
import type { ReaderSettings } from './types'

const scrollOptions = [
  { value: 'scroll' as const, label: '滚动' },
  { value: 'paged' as const, label: '翻页' },
  { value: 'auto' as const, label: '自动' },
]

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

    <!-- Chapter info -->
    <button
      class="flex items-center gap-2 px-5 pb-3 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
      @click="emit('openChapters')"
    >
      <List class="size-4 shrink-0" />
      <span>目录</span>
      <span class="tabular-nums text-xs opacity-60">
        {{ chapterIndex + 1 }} / {{ totalChapters }}
      </span>
    </button>

    <div class="px-5 pb-5 space-y-5">
      <!-- Font family -->
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-2.5">字体</p>
        <Select
          :model-value="settings.fontFamily"
          @update:model-value="
            (v) => {
              if (v) updateSetting('fontFamily', String(v))
            }
          "
        >
          <SelectTrigger class="h-9 text-sm">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem
              v-for="f in FONT_OPTIONS"
              :key="f.value"
              :value="f.value"
            >
              {{ f.label }}
            </SelectItem>
          </SelectContent>
        </Select>
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

      <!-- Scroll mode -->
      <div>
        <p class="text-xs font-medium text-muted-foreground mb-2.5">阅读模式</p>
        <div class="flex rounded-lg border border-input overflow-hidden">
          <button
            v-for="opt in scrollOptions"
            :key="opt.value"
            class="flex-1 px-3 py-1.5 text-xs font-medium transition-colors"
            :class="
              settings.scrollMode === opt.value
                ? 'bg-primary text-primary-foreground'
                : 'bg-transparent text-muted-foreground hover:bg-muted'
            "
            @click="updateSetting('scrollMode', opt.value)"
          >
            {{ opt.label }}
          </button>
        </div>
      </div>

      <!-- Auto scroll speed (only in auto mode) -->
      <div v-if="settings.scrollMode === 'auto'">
        <div class="flex items-center justify-between mb-2.5">
          <p class="text-xs font-medium text-muted-foreground">自动速度</p>
          <span class="text-xs tabular-nums text-muted-foreground">
            {{ settings.autoScrollSpeed }}
          </span>
        </div>
        <Slider
          :model-value="[settings.autoScrollSpeed]"
          :min="10"
          :max="200"
          :step="10"
          @update:model-value="
            (v) => {
              if (v) updateSetting('autoScrollSpeed', v[0])
            }
          "
        />
      </div>
    </div>
  </div>
</template>
