<script setup lang="ts">
import { ref, computed, inject } from 'vue'
import {
  Sun,
  Moon,
  Coffee,
  Snowflake,
  Flower2,
  TreePine,
  Type,
  BookOpen,
  ScrollText,
  Play,
  Eye,
  ImageIcon,
  Plus,
  Trash2,
} from 'lucide-vue-next'
import { toast } from 'vue-sonner'
import { saveConfig, getConfig } from '@/db/config'
import type { AppConfig, AppTheme } from '@/db/types'
import { DEFAULT_CONFIG } from '@/db/types'
import { Slider } from '@/components/ui/slider'
import { FONT_OPTIONS } from '@/components/reader/types'
import { useBackgroundImage } from '@/composables/useBackgroundImage'

const config = ref<AppConfig>({ ...DEFAULT_CONFIG })

const applyTheme = inject<(theme: AppTheme) => void>('applyTheme', () => {})

const {
  images,
  activeImageId,
  bgOpacity: bgOpacityRef,
  bgBlur: bgBlurRef,
  loadAll,
  uploadImage,
  selectImage,
  deselectImage,
  removeImage,
  updateSettingsDebounced,
} = useBackgroundImage()

const bgOpacity = computed({
  get: () => [bgOpacityRef.value],
  set: (v: number[]) => {
    updateSettingsDebounced({ opacity: v[0] })
  },
})

const bgBlur = computed({
  get: () => [bgBlurRef.value],
  set: (v: number[]) => {
    updateSettingsDebounced({ blur: v[0] })
  },
})

const fileInput = ref<HTMLInputElement | null>(null)

function triggerUpload() {
  fileInput.value?.click()
}

async function handleFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  if (!file) return
  await uploadImage(file)
  input.value = ''
}

async function handleSelectImage(id: string) {
  if (activeImageId.value === id) {
    await deselectImage()
  } else {
    await selectImage(id)
  }
}

async function handleRemoveImage(id: string) {
  await removeImage(id)
}

const themeCards = [
  {
    id: 'light' as AppTheme,
    name: '浅色',
    icon: Sun,
    bg: '#FCFAF7',
    text: '#1A1A1A',
    accent: '#6B6B6B',
  },
  {
    id: 'dark' as AppTheme,
    name: '深色',
    icon: Moon,
    bg: '#1A1A1E',
    text: '#E0E0E0',
    accent: '#8B8B8B',
  },
  {
    id: 'parchment' as AppTheme,
    name: '护眼',
    icon: Coffee,
    bg: '#F4E4C1',
    text: '#3E2723',
    accent: '#8D6E63',
  },
  {
    id: 'frost' as AppTheme,
    name: '霜华',
    icon: Snowflake,
    bg: '#F0F4FA',
    text: '#3D4A5C',
    accent: '#5B8DB8',
  },
  {
    id: 'peach' as AppTheme,
    name: '桃夭',
    icon: Flower2,
    bg: '#FBEDE8',
    text: '#4D332E',
    accent: '#C47A6B',
  },
  {
    id: 'pine' as AppTheme,
    name: '松烟',
    icon: TreePine,
    bg: '#EAF0E7',
    text: '#2E3D33',
    accent: '#5C8A6B',
  },
]

const appTheme = computed({
  get: () => config.value.appTheme,
  set: (v: AppTheme) => {
    config.value.appTheme = v
    applyTheme(v)
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
}))

const currentThemeCard = computed(() => themeCards.find((t) => t.id === config.value.appTheme))

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
loadAll()
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Theme Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <Sun class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">应用主题</h3>
        </div>
        <p class="text-xs text-muted-foreground">选择应用的整体外观配色</p>
      </div>

      <div class="grid grid-cols-3 gap-3">
        <button
          v-for="t in themeCards"
          :key="t.id"
          class="rounded-xl border-2 p-3 transition-all duration-200 text-left cursor-pointer"
          :class="
            appTheme === t.id
              ? 'border-primary ring-1 ring-primary/20 shadow-md'
              : 'border-transparent hover:border-border/80 shadow-sm'
          "
          @click="appTheme = t.id"
        >
          <div
            class="rounded-lg px-2.5 py-2 mb-2.5 text-[10px] leading-relaxed border border-black/5"
            :style="{ backgroundColor: t.bg, color: t.text }"
          >
            <div class="flex items-center gap-1 mb-1.5">
              <span class="size-1.5 rounded-full shrink-0" :style="{ backgroundColor: t.accent }" />
              <span class="h-px flex-1" :style="{ backgroundColor: t.accent, opacity: 0.3 }" />
            </div>
            <div class="font-medium">Aa</div>
            <div class="opacity-40">之乎者也</div>
          </div>
          <div class="flex items-center justify-center gap-1.5">
            <component :is="t.icon" class="size-3.5" />
            <p class="text-xs font-medium">{{ t.name }}</p>
          </div>
        </button>
      </div>
    </section>

    <!-- Background Image Section -->
    <section class="rounded-xl border bg-card shadow-sm p-5 space-y-4">
      <div>
        <div class="flex items-center gap-2 mb-1">
          <ImageIcon class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">背景图片</h3>
        </div>
        <p class="text-xs text-muted-foreground">上传图片作为应用背景，支持多张切换选择</p>
      </div>

      <div class="grid grid-cols-4 gap-3">
        <!-- Image items -->
        <div
          v-for="img in images"
          :key="img.id"
          class="group relative aspect-square rounded-lg border-2 overflow-hidden cursor-pointer transition-all duration-200"
          :class="
            activeImageId === img.id
              ? 'border-primary ring-1 ring-primary/20 shadow-md'
              : 'border-transparent hover:border-border/80 shadow-sm'
          "
          @click="handleSelectImage(img.id)"
        >
          <img
            :src="img.thumbnailUrl"
            :alt="img.name"
            class="absolute inset-0 w-full h-full object-cover"
          />
          <button
            class="absolute top-1 right-1 size-5 rounded-full bg-black/50 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity hover:bg-black/70"
            aria-label="删除图片"
            @click.stop="handleRemoveImage(img.id)"
          >
            <Trash2 class="size-3 text-white" />
          </button>
        </div>

        <!-- Upload button -->
        <button
          class="aspect-square rounded-lg border-2 border-dashed border-border/60 flex flex-col items-center justify-center gap-1.5 cursor-pointer hover:border-primary/50 hover:bg-muted/50 transition-all duration-200"
          @click="triggerUpload"
        >
          <Plus class="size-5 text-muted-foreground" />
          <span class="text-[10px] text-muted-foreground">上传图片</span>
        </button>
      </div>

      <input
        ref="fileInput"
        type="file"
        accept="image/jpeg,image/png,image/webp"
        class="hidden"
        @change="handleFileChange"
      />

      <template v-if="activeImageId">
        <div class="space-y-4 pt-1">
          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>透明度</span>
              <span>{{ bgOpacityRef }}%</span>
            </div>
            <Slider
              :model-value="bgOpacity"
              :min="0"
              :max="100"
              :step="5"
              @update:model-value="(v?: number[]) => v && (bgOpacity = v)"
            />
          </div>

          <div class="space-y-1.5">
            <div class="flex justify-between text-xs text-muted-foreground">
              <span>模糊度</span>
              <span>{{ bgBlurRef }}px</span>
            </div>
            <Slider
              :model-value="bgBlur"
              :min="0"
              :max="20"
              :step="1"
              @update:model-value="(v?: number[]) => v && (bgBlur = v)"
            />
          </div>
        </div>
      </template>
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

      <div class="grid grid-cols-2 gap-2">
        <button
          v-for="f in FONT_OPTIONS"
          :key="f.value"
          class="rounded-lg border p-3 transition-all duration-200 cursor-pointer"
          :class="
            fontFamily === f.value
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-transparent hover:border-border/80'
          "
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

      <div class="space-y-4 pt-1">
        <div class="space-y-1.5">
          <div class="flex justify-between text-xs text-muted-foreground">
            <span>字号</span>
            <span>{{ config.readingSettings.fontSize }}px</span>
          </div>
          <Slider
            :model-value="fontSize"
            :min="12"
            :max="28"
            :step="1"
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
            :min="1.2"
            :max="3"
            :step="0.1"
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
            :min="0"
            :max="3"
            :step="0.5"
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
        <button
          class="rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 text-center"
          :class="
            scrollMode === 'scroll'
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-transparent hover:border-border/80 shadow-sm'
          "
          @click="scrollMode = 'scroll'"
        >
          <ScrollText
            class="size-5"
            :class="scrollMode === 'scroll' ? 'text-primary' : 'text-muted-foreground'"
          />
          <div>
            <p class="text-xs font-medium">滚动</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">连续滚动阅读</p>
          </div>
        </button>

        <button
          class="rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 text-center"
          :class="
            scrollMode === 'paged'
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-transparent hover:border-border/80 shadow-sm'
          "
          @click="scrollMode = 'paged'"
        >
          <BookOpen
            class="size-5"
            :class="scrollMode === 'paged' ? 'text-primary' : 'text-muted-foreground'"
          />
          <div>
            <p class="text-xs font-medium">翻页</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">左右翻页浏览</p>
          </div>
        </button>

        <button
          class="rounded-xl border-2 p-4 transition-all duration-200 cursor-pointer flex flex-col items-center gap-2 text-center"
          :class="
            scrollMode === 'auto'
              ? 'border-primary bg-primary/5 shadow-sm'
              : 'border-transparent hover:border-border/80 shadow-sm'
          "
          @click="scrollMode = 'auto'"
        >
          <Play
            class="size-5"
            :class="scrollMode === 'auto' ? 'text-primary' : 'text-muted-foreground'"
          />
          <div>
            <p class="text-xs font-medium">自动</p>
            <p class="text-[10px] text-muted-foreground mt-0.5">自动滚动</p>
          </div>
        </button>
      </div>

      <div v-if="scrollMode === 'auto'" class="pt-4 border-t space-y-1.5">
        <div class="flex justify-between text-xs text-muted-foreground">
          <span>自动滚动速度</span>
          <span>{{ config.readingSettings.autoScrollSpeed }}</span>
        </div>
        <Slider
          :model-value="autoScrollSpeed"
          :min="10"
          :max="100"
          :step="5"
          @update:model-value="(v?: number[]) => v && (autoScrollSpeed = v)"
        />
      </div>
    </section>

    <!-- Preview Section -->
    <section class="rounded-xl border bg-card shadow-sm overflow-hidden">
      <div class="h-1" :style="{ backgroundColor: currentThemeCard?.accent ?? '#A67C52' }" />

      <div class="p-5 space-y-1 border-b">
        <div class="flex items-center gap-2">
          <Eye class="size-4 text-muted-foreground" />
          <h3 class="text-sm font-medium">实时预览</h3>
        </div>
        <p class="text-xs text-muted-foreground">在此预览您的阅读设置效果</p>
      </div>

      <div class="p-6 md:p-8 transition-all duration-200" :style="previewStyle">
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
