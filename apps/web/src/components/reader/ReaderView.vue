<script setup lang="ts">
import { ref, computed, watch, nextTick, onMounted, onUnmounted } from 'vue'
import DOMPurify from 'dompurify'
import type { ReaderSettings } from './types'

const props = defineProps<{
  content: string
  title: string
  chapterIndex: number
  totalChapters: number
  settings: ReaderSettings
}>()

const renderedContent = computed(() => {
  const html = props.content
    .split(/\n\n+/)
    .filter((p) => p.trim())
    .map((p) => `<p>${p.replace(/\n/g, '<br>')}</p>`)
    .join('')
  return DOMPurify.sanitize(html)
})

const emit = defineEmits<{
  prevChapter: []
  nextChapter: []
  showControls: []
  updateProgress: [scrollPercent: number]
}>()

// --- Shared state ---
const container = ref<HTMLElement>()
const scrollPercent = ref(0)
const isPaged = computed(() => props.settings.scrollMode === 'paged')

const readerStyle = computed(() => ({
  '--reader-font': props.settings.fontFamily,
  '--reader-font-size': `${props.settings.fontSize}px`,
  '--reader-line-height': props.settings.lineHeight,
  '--reader-paragraph-spacing': `${props.settings.paragraphSpacing}em`,
}))

const progressPercent = computed(() => {
  if (isPaged.value) {
    if (totalPages.value <= 1) return 0
    return Math.round((currentPage.value / (totalPages.value - 1)) * 100)
  }
  return Math.round(scrollPercent.value * 100)
})

// --- Scroll mode ---
function onScroll() {
  if (!container.value) return
  const { scrollTop, scrollHeight, clientHeight } = container.value
  scrollPercent.value = scrollTop / (scrollHeight - clientHeight) || 0
  emit('updateProgress', scrollPercent.value)
}

function onClickScroll(e: MouseEvent) {
  const ratio = e.clientY / window.innerHeight
  if (ratio > 0.25 && ratio < 0.75) {
    emit('showControls')
  }
}

// --- Paged mode ---
const pagedContainer = ref<HTMLElement>()
const pagedContent = ref<HTMLElement>()
const currentPage = ref(0)
const totalPages = ref(1)
let touchStartX = 0
let touchStartY = 0
let resizeObserver: ResizeObserver | null = null
let resizeTimer: ReturnType<typeof setTimeout> | null = null
// Track chapter navigation direction for correct landing page
let chapterNavDirection: 'forward' | 'backward' | null = null
// Guard against concurrent recalculatePages calls
let recalculateGeneration = 0

function recalculatePages() {
  if (!pagedContainer.value || !pagedContent.value) return
  const cw = pagedContainer.value.clientWidth
  const ch = pagedContainer.value.clientHeight
  if (cw <= 0 || ch <= 0) return

  const gen = ++recalculateGeneration
  // Capture and clear direction to prevent stale values from unconsumed chapter changes
  const direction = chapterNavDirection
  chapterNavDirection = null

  // Disable transition during chapter switch to prevent flashing
  pagedContent.value.style.transition = 'none'
  // Reset transform immediately so new content starts from a known position
  pagedContent.value.style.transform = 'translateX(0)'

  pagedContent.value.style.columnWidth = `${cw}px`
  pagedContent.value.style.height = `${ch}px`

  // Let the browser reflow, then measure
  requestAnimationFrame(() => {
    if (gen !== recalculateGeneration) return
    if (!pagedContent.value || !pagedContainer.value) return
    const totalWidth = pagedContent.value.scrollWidth
    totalPages.value = Math.max(1, Math.round(totalWidth / cw))

    // Determine landing page based on navigation direction
    if (direction === 'backward') {
      currentPage.value = totalPages.value - 1
    } else {
      currentPage.value = 0
    }

    applyPageTransform()
    // Re-enable transition after the browser has painted
    requestAnimationFrame(() => {
      if (pagedContent.value) {
        pagedContent.value.style.transition = ''
      }
    })
    updatePagedProgress()
  })
}

function applyPageTransform() {
  if (!pagedContent.value || !pagedContainer.value) return
  const offset = currentPage.value * pagedContainer.value.clientWidth
  pagedContent.value.style.transform = `translateX(-${offset}px)`
}

function goToPage(page: number) {
  currentPage.value = Math.max(0, Math.min(page, totalPages.value - 1))
  applyPageTransform()
  updatePagedProgress()
}

function updatePagedProgress() {
  const p = totalPages.value > 1 ? currentPage.value / (totalPages.value - 1) : 0
  emit('updateProgress', p)
}

function flipPage(dir: 'prev' | 'next') {
  if (dir === 'prev') {
    if (currentPage.value > 0) {
      goToPage(currentPage.value - 1)
    } else {
      chapterNavDirection = 'backward'
      emit('prevChapter')
    }
  } else {
    if (currentPage.value < totalPages.value - 1) {
      goToPage(currentPage.value + 1)
    } else {
      chapterNavDirection = 'forward'
      emit('nextChapter')
    }
  }
}

function navigateToChapter(dir: 'prev' | 'next') {
  chapterNavDirection = dir === 'prev' ? 'backward' : 'forward'
  if (dir === 'prev') {
    emit('prevChapter')
  } else {
    emit('nextChapter')
  }
}

function onClickPaged(e: MouseEvent) {
  const ratioX = e.clientX / window.innerWidth
  if (ratioX < 0.33) {
    flipPage('prev')
  } else if (ratioX > 0.67) {
    flipPage('next')
  } else {
    emit('showControls')
  }
}

function onTouchStart(e: TouchEvent) {
  touchStartX = e.touches[0].clientX
  touchStartY = e.touches[0].clientY
}

function onTouchEnd(e: TouchEvent) {
  const dx = e.changedTouches[0].clientX - touchStartX
  const dy = Math.abs(e.changedTouches[0].clientY - touchStartY)
  if (Math.abs(dx) < 50 || dy > Math.abs(dx)) return
  if (dx > 0) {
    flipPage('prev')
  } else {
    flipPage('next')
  }
}

// --- Shared keyboard handler ---
function onKeydown(e: KeyboardEvent) {
  const target = isPaged.value ? pagedContainer.value : container.value
  if (!target?.offsetParent) return
  if (e.key === 'ArrowLeft') {
    e.preventDefault()
    if (isPaged.value) {
      flipPage('prev')
    } else {
      emit('prevChapter')
    }
  } else if (e.key === 'ArrowRight') {
    e.preventDefault()
    if (isPaged.value) {
      flipPage('next')
    } else {
      emit('nextChapter')
    }
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    emit('prevChapter')
  } else if (e.key === 'ArrowDown') {
    e.preventDefault()
    emit('nextChapter')
  }
}

function scrollToPos(pos: number) {
  if (isPaged.value) return
  container.value?.scrollTo({ top: pos, behavior: 'instant' })
}

// --- Watchers ---
// Single watcher for chapter/content changes to avoid duplicate recalculatePages calls
watch([() => props.chapterIndex, () => props.content], () => {
  if (isPaged.value) {
    nextTick(() => recalculatePages())
  } else {
    container.value?.scrollTo({ top: 0, behavior: 'instant' })
  }
})

watch(
  () => props.settings,
  () => {
    if (isPaged.value) nextTick(() => recalculatePages())
  },
  { deep: true },
)

watch(isPaged, (paged) => {
  if (paged) {
    nextTick(() => {
      setupResizeObserver()
      recalculatePages()
      goToPage(0)
    })
  } else {
    resizeObserver?.disconnect()
    resizeObserver = null
  }
})

// --- Lifecycle ---
function setupResizeObserver() {
  resizeObserver?.disconnect()
  if (!pagedContainer.value) return
  resizeObserver = new ResizeObserver(() => {
    if (resizeTimer) clearTimeout(resizeTimer)
    resizeTimer = setTimeout(() => recalculatePages(), 100)
  })
  resizeObserver.observe(pagedContainer.value)
}

onMounted(() => {
  window.addEventListener('keydown', onKeydown)
  if (isPaged.value) {
    nextTick(() => {
      setupResizeObserver()
      recalculatePages()
    })
  }
})

onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  resizeObserver?.disconnect()
})

defineExpose({ scrollToPos })
</script>

<template>
  <!-- Scroll mode -->
  <div
    v-if="!isPaged"
    ref="container"
    class="reader h-full overflow-y-auto overscroll-none bg-background/65 text-foreground"
    :style="readerStyle"
    @scroll="onScroll"
    @click="onClickScroll"
  >
    <div class="sticky top-0 z-20 h-0.5 bg-muted/30">
      <div
        class="h-full transition-[width] duration-200 ease-out"
        :style="{ width: `${progressPercent}%`, backgroundColor: 'var(--primary)' }"
      />
    </div>

    <div class="w-full max-w-[680px] mx-auto px-5 sm:px-8">
      <header class="pt-5 pb-2 text-center">
        <h2 class="text-xl font-bold leading-relaxed tracking-wide">
          {{ title }}
        </h2>
        <div class="flex items-center justify-center gap-3 mt-2">
          <div
            class="h-px flex-1 max-w-16 opacity-20"
            :style="{ backgroundColor: 'currentColor' }"
          />
          <span class="text-xs font-normal opacity-40 tracking-wider">
            {{ chapterIndex + 1 }} / {{ totalChapters }}
          </span>
          <div
            class="h-px flex-1 max-w-16 opacity-20"
            :style="{ backgroundColor: 'currentColor' }"
          />
        </div>
      </header>

      <article
        class="article-content prose max-w-none pb-6"
        :style="{
          fontFamily: 'var(--reader-font)',
          fontSize: 'var(--reader-font-size)',
          lineHeight: 'var(--reader-line-height)',
        }"
        v-html="renderedContent"
      />

      <nav class="flex items-center justify-between pb-8" @click.stop>
        <button
          v-if="chapterIndex > 0"
          class="text-sm opacity-50 hover:opacity-100 transition-opacity px-4 py-2.5 rounded-lg hover:bg-foreground/5"
          @click="emit('prevChapter')"
        >
          {{ $t('story.previousChapter') }}
        </button>
        <span class="flex-1" />
        <button
          v-if="chapterIndex < totalChapters - 1"
          class="text-sm opacity-50 hover:opacity-100 transition-opacity px-4 py-2.5 rounded-lg hover:bg-foreground/5"
          @click="emit('nextChapter')"
        >
          {{ $t('story.nextChapter') }}
        </button>
      </nav>
    </div>
  </div>

  <!-- Paged mode -->
  <div
    v-else
    ref="pagedContainer"
    class="reader-paged h-full overflow-hidden bg-background/65 text-foreground relative"
    :style="readerStyle"
    @click="onClickPaged"
    @touchstart="onTouchStart"
    @touchend="onTouchEnd"
  >
    <div class="absolute top-0 left-0 right-0 z-20 h-0.5 bg-muted/30">
      <div
        class="h-full transition-[width] duration-200 ease-out"
        :style="{ width: `${progressPercent}%`, backgroundColor: 'var(--primary)' }"
      />
    </div>

    <!--
      CSS multi-column layout: column-width = container width, height = container height.
      Each column = one page. Content flows left-to-right across columns.
      position:absolute + no explicit width lets the element expand to fit all columns.
      We navigate via translateX.
    -->
    <div
      ref="pagedContent"
      class="paged-columns"
      :style="{
        fontFamily: 'var(--reader-font)',
        fontSize: 'var(--reader-font-size)',
        lineHeight: 'var(--reader-line-height)',
      }"
    >
      <header class="pt-5 pb-2 text-center px-5 sm:px-8">
        <h2 class="text-xl font-bold leading-relaxed tracking-wide">
          {{ title }}
        </h2>
        <div class="flex items-center justify-center gap-3 mt-2">
          <div
            class="h-px flex-1 max-w-16 opacity-20"
            :style="{ backgroundColor: 'currentColor' }"
          />
          <span class="text-xs font-normal opacity-40 tracking-wider">
            {{ chapterIndex + 1 }} / {{ totalChapters }}
          </span>
          <div
            class="h-px flex-1 max-w-16 opacity-20"
            :style="{ backgroundColor: 'currentColor' }"
          />
        </div>
      </header>

      <article
        class="article-content prose max-w-none pb-6 px-5 sm:px-8"
        v-html="renderedContent"
      />

      <nav class="flex items-center justify-between pb-8 px-5 sm:px-8" @click.stop>
        <button
          v-if="chapterIndex > 0"
          class="text-sm opacity-50 hover:opacity-100 transition-opacity px-4 py-2.5 rounded-lg hover:bg-foreground/5"
          @click="navigateToChapter('prev')"
        >
          {{ $t('story.previousChapter') }}
        </button>
        <span class="flex-1" />
        <button
          v-if="chapterIndex < totalChapters - 1"
          class="text-sm opacity-50 hover:opacity-100 transition-opacity px-4 py-2.5 rounded-lg hover:bg-foreground/5"
          @click="navigateToChapter('next')"
        >
          {{ $t('story.nextChapter') }}
        </button>
      </nav>
    </div>

    <div
      class="absolute bottom-3 left-1/2 -translate-x-1/2 text-xs opacity-30 select-none pointer-events-none"
    >
      {{ currentPage + 1 }} / {{ totalPages }}
    </div>
  </div>
</template>

<style scoped>
/* Scroll mode scrollbar */
.reader::-webkit-scrollbar {
  width: 5px;
}
.reader::-webkit-scrollbar-track {
  background: transparent;
}
.reader::-webkit-scrollbar-thumb {
  background: color-mix(in srgb, var(--foreground) 18%, transparent);
  border-radius: 3px;
}
.reader::-webkit-scrollbar-thumb:hover {
  background: color-mix(in srgb, var(--foreground) 30%, transparent);
}

.article-content :deep(p) {
  text-indent: 2em;
  margin-bottom: var(--reader-paragraph-spacing) !important;
  break-inside: avoid;
}
.article-content :deep(h2),
.article-content :deep(h3) {
  break-inside: avoid;
}

/* Paged mode: CSS multi-column layout */
.paged-columns {
  position: absolute;
  top: 0;
  left: 0;
  column-gap: 0;
  column-fill: auto;
  /* column-width and height set via JS in recalculatePages() */
  transition: transform 0.3s ease;
}
</style>
