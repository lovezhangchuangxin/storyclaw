<script setup lang="ts">
import { ref, computed } from 'vue'
import { Palette, Type, BookOpen, ScrollText, Play, Eye } from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'
import { Slider } from '@/components/ui/slider'
import { PRESET_THEMES, FONT_OPTIONS } from '@/components/reader/types'

const config = ref<AppConfig>({ ...DEFAULT_CONFIG })

const theme = computed({
  get: () => config.value.readingTheme,
  set: (v: string) => {
    config.value.readingTheme = v
    const preset = PRESET_THEMES.find((t) => t.id === v)
    if (preset) {
      config.value.readingSettings.backgroundColor = preset.backgroundColor
      config.value.readingSettings.textColor = preset.textColor
    }
    save()
  },
})

const fontFamily = computed({
  get: () => config.value.readingSettings.fontFamily,
  set: (v: string) => {
    config.value.readingSettings.fontFamily = v
    save()
  },
})

const fontSize = computed({
  get: () => [config.value.readingSettings.fontSize],
  set: (v: number[]) => {
    config.value.readingSettings.fontSize = v[0]
    debouncedSave()
  },
})

const lineHeight = computed({
  get: () => [config.value.readingSettings.lineHeight],
  set: (v: number[]) => {
    config.value.readingSettings.lineHeight = v[0]
    debouncedSave()
  },
})

const paragraphSpacing = computed({
  get: () => [config.value.readingSettings.paragraphSpacing],
  set: (v: number[]) => {
    config.value.readingSettings.paragraphSpacing = v[0]
    debouncedSave()
  },
})

const scrollMode = computed({
  get: () => config.value.readingSettings.scrollMode,
  set: (v: 'scroll' | 'paged' | 'auto') => {
    config.value.readingSettings.scrollMode = v
    save()
  },
})

const autoScrollSpeed = computed({
  get: () => [config.value.readingSettings.autoScrollSpeed],
  set: (v: number[]) => {
    config.value.readingSettings.autoScrollSpeed = v[0]
    debouncedSave()
  },
})

const previewStyle = computed(() => ({
  fontFamily: config.value.readingSettings.fontFamily,
  fontSize: `${config.value.readingSettings.fontSize}px`,
  lineHeight: config.value.readingSettings.lineHeight,
  color: config.value.readingSettings.textColor,
  backgroundColor: config.value.readingSettings.backgroundColor,
}))

const currentThemePreset = computed(() =>
  PRESET_THEMES.find((t) => t.id === config.value.readingTheme),
)

async function loadConfig() {
  try {
    config.value = await getConfig()
  } catch (e) {
    toast.error('加载配置失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

async function save() {
  const snapshot = JSON.parse(JSON.stringify(config.value)) as AppConfig
  try {
    await saveConfig(snapshot)
    config.value = snapshot
  } catch (e) {
    toast.error('保存失败', {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

function debouncedSave() {
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(() => save(), 300)
}

loadConfig()
</script>

<template>
  <div class="max-w-2xl mx-auto p-4 md:p-6 space-y-5">

    <!-- Theme Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Palette class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">阅读主题</h3>
        </div>
        <p class="text-xs text-muted-foreground">选择舒适的阅读配色方案</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="t in PRESET_THEMES"
          :key="t.id"
          class="rounded-xl border-2 p-3 transition-all duration-200 text-left cursor-pointer"
          :class="theme === t.id
            ? 'border-primary ring-1 ring-primary/20 shadow-md'
            : 'border-transparent hover:border-border/80 shadow-sm'"
          @click="theme = t.id"
        >
          <!-- Micro preview block -->
          <div
            class="rounded-lg px-2.5 py-2 mb-2.5 text-[10px] leading-relaxed border border-black/5"
            :style="{ backgroundColor: t.backgroundColor, color: t.textColor }"
          >
            <div class="flex items-center gap-1 mb-1.5">
              <span class="size-1.5 rounded-full shrink-0" :style="{ backgroundColor: t.accentColor }" />
              <span class="h-px flex-1" :style="{ backgroundColor: t.accentColor, opacity: 0.3 }" />
            </div>
            <div class="font-medium">Aa</div>
            <div class="opacity-40">之乎者也</div>
          </div>
          <p class="text-xs font-medium text-center">{{ t.name }}</p>
        </button>
      </div>
    </section>

    <!-- Font & Typography Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Type class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">字体与排版</h3>
        </div>
        <p class="text-xs text-muted-foreground">调整阅读文字的外观与间距</p>
      </div>

      <!-- Font picker: visual "Aa" cards -->
      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="f in FONT_OPTIONS"
          :key="f.value"
          class="rounded-lg border p-3 transition-all duration-200 cursor-pointer"
          :class="fontFamily === f.value
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-transparent hover:border-border/80'"
          @click="fontFamily = f.value"
        >
          <div
            class="text-2xl font-medium leading-none mb-1.5 tracking-tight"
            :style="{ fontFamily: f.value }"
          >
            Aa
          </div>
          <p class="text-[11px] text-muted-foreground text-center">{{ f.label }}</p>
        </button>
      </div>

      <!-- Typography sliders -->
      <div class="space-y-4 pt-1">
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>字号</span>
            <span>{{ config.readingSettings.fontSize }}px</span>
          </div>
          <Slider
            :model-value="fontSize"
            :min="12" :max="28" :step="1"
            @update:model-value="(v?: number[]) => v && (fontSize = v)"
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>行高</span>
            <span>{{ config.readingSettings.lineHeight.toFixed(1) }}</span>
          </div>
          <Slider
            :model-value="lineHeight"
            :min="1.2" :max="3" :step="0.1"
            @update:model-value="(v?: number[]) => v && (lineHeight = v)"
          />
        </div>

        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>段间距</span>
            <span>{{ config.readingSettings.paragraphSpacing.toFixed(1) }}</span>
          </div>
          <Slider
            :model-value="paragraphSpacing"
            :min="0" :max="3" :step="0.5"
            @update:model-value="(v?: number[]) => v && (paragraphSpacing = v)"
          />
        </div>
      </div>
    </section>

    <!-- Scroll Mode Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <BookOpen class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">翻页模式</h3>
        </div>
        <p class="text-xs text-muted-foreground">选择适合的阅读翻页方式</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <!-- Scroll mode -->
        <button
          class="rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 text-center"
          :class="scrollMode === 'scroll'
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-transparent hover:border-border/80 shadow-sm'"
          @click="scrollMode = 'scroll'"
        >
          <ScrollText class="size-5" :class="scrollMode === 'scroll' ? 'text-primary' : 'text-muted-foreground'" />
          <div>
            <p class="text-xs font-medium">滚动</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">连续滚动阅读</p>
          </div>
        </button>

        <!-- Paged mode -->
        <button
          class="rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 text-center"
          :class="scrollMode === 'paged'
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-transparent hover:border-border/80 shadow-sm'"
          @click="scrollMode = 'paged'"
        >
          <BookOpen class="size-5" :class="scrollMode === 'paged' ? 'text-primary' : 'text-muted-foreground'" />
          <div>
            <p class="text-xs font-medium">翻页</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">左右翻页浏览</p>
          </div>
        </button>

        <!-- Auto mode -->
        <button
          class="rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 text-center"
          :class="scrollMode === 'auto'
            ? 'border-primary bg-primary/5 shadow-sm'
            : 'border-transparent hover:border-border/80 shadow-sm'"
          @click="scrollMode = 'auto'"
        >
          <Play class="size-5" :class="scrollMode === 'auto' ? 'text-primary' : 'text-muted-foreground'" />
          <div>
            <p class="text-xs font-medium">自动</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">自动滚动</p>
          </div>
        </button>
      </div>

      <!-- Auto scroll speed (conditional) -->
      <div v-if="scrollMode === 'auto'" class="pt-4 border-t space-y-1.5">
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>自动滚动速度</span>
          <span>{{ config.readingSettings.autoScrollSpeed }}</span>
        </div>
        <Slider
          :model-value="autoScrollSpeed"
          :min="10" :max="100" :step="5"
          @update:model-value="(v?: number[]) => v && (autoScrollSpeed = v)"
        />
      </div>
    </section>

    <!-- Preview Section -->
    <section class="rounded-xl border bg-card shadow-sm overflow-hidden">
      <!-- Decorative accent bar -->
      <div
        class="h-1"
        :style="{ backgroundColor: currentThemePreset?.accentColor ?? '#8B7355' }"
      />

      <div class="p-5 space-y-1 border-b">
        <div class="flex items-center gap-2">
          <Eye class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">实时预览</h3>
        </div>
        <p class="text-xs text-muted-foreground">在此预览您的阅读设置效果</p>
      </div>

      <div
        class="p-6 md:p-8 transition-all duration-200"
        :style="previewStyle"
      >
        <p>
          天色暗下来的时候，林间的风也停了。她站在桥头，望着远处隐约的灯火，心里想着那些已经说不出口的话。
        </p>
        <p :style="{ marginTop: `${config.readingSettings.paragraphSpacing}em` }">
          "你还在等什么？"身后传来一个声音，不大，却在寂静中格外清晰。
        </p>
      </div>
    </section>

  </div>
</template>
