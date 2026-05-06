<script setup lang="ts">
import { ref, computed, inject, h, watch, onMounted, onUnmounted, defineAsyncComponent } from 'vue'
import type { Component } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from 'vue-i18n'
import { MessageCircle, BookOpen, Database } from 'lucide-vue-next'
import ReaderView from '@/components/reader/ReaderView.vue'
import ReaderControls from '@/components/reader/ReaderControls.vue'
import { getChaptersByNovelId } from '@/db/chapters'
import { getConfig, saveConfig } from '@/db/config'
import type { ReaderSettings } from '@/components/reader/types'
import type { Chapter } from '@/db/types'

const AgentChat = defineAsyncComponent(() => import('./components/AgentChat.vue'))
const NovelDataDrawer = defineAsyncComponent(() => import('./components/NovelDataDrawer.vue'))

const route = useRoute()
const router = useRouter()
const storyId = computed(() => route.params.id as string)

const mode = ref<'reader' | 'agent'>(route.query.tab === 'agent' ? 'agent' : 'reader')
const showControls = ref(false)
const dataDrawerOpen = ref(false)

const setTopbarExtra = inject<(c: Component | null) => void>('setTopbarExtra')
const setTitle = inject<(t: string | null) => void>('setTitle')

const { t } = useI18n()

const tabTitles = computed<Record<'reader' | 'agent', string>>(() => ({
  reader: t('story.reader'),
  agent: t('story.agentTab'),
}))

watch(mode, async (val) => {
  router.replace({
    query: val === 'agent' ? { tab: 'agent' } : {},
  })
  setTitle?.(tabTitles.value[val])
  if (val === 'reader' && storyId.value) {
    chapters.value = await getChaptersByNovelId(storyId.value)
    chapters.value.sort((a, b) => a.index - b.index)
  }
})

onMounted(() => {
  setTitle?.(tabTitles.value[mode.value])
  setTopbarExtra?.({
    setup() {
      return () =>
        h('div', { class: 'flex items-center gap-0.5' }, [
          h(
            'button',
            {
              class:
                'size-8 flex items-center justify-center rounded-md hover:bg-muted shrink-0 transition duration-150 active:scale-90',
              'aria-label': t('story.viewNovelData'),
              onClick: () => {
                dataDrawerOpen.value = true
              },
            },
            [h(Database, { class: 'size-5' })],
          ),
          h(
            'button',
            {
              class:
                'size-8 flex items-center justify-center rounded-md hover:bg-muted shrink-0 transition duration-150 active:scale-90',
              onClick: () => {
                mode.value = mode.value === 'reader' ? 'agent' : 'reader'
              },
              'aria-label':
                mode.value === 'reader' ? t('story.switchToAgent') : t('story.switchToReader'),
            },
            [
              h(
                'span',
                {
                  key: mode.value,
                  class: 'inline-flex animate-in zoom-in-90 duration-200',
                },
                [h(mode.value === 'reader' ? BookOpen : MessageCircle, { class: 'size-5' })],
              ),
            ],
          ),
        ])
    },
  })
})

onUnmounted(() => {
  setTopbarExtra?.(null)
  setTitle?.(null)
})

const settings = ref<ReaderSettings>({
  fontFamily: '"Noto Sans SC", Inter, system-ui, sans-serif',
  fontSize: 18,
  lineHeight: 1.6,
  paragraphSpacing: 1,
  scrollMode: 'scroll',
})

getConfig().then((c) => {
  if (c?.readingSettings) settings.value = c.readingSettings as ReaderSettings
})

const chapters = ref<Chapter[]>([])
const chapterIndex = ref(0)

const currentChapter = computed(() => chapters.value[chapterIndex.value])
const totalChapters = computed(() => chapters.value.length)

watch(
  storyId,
  async (id) => {
    if (!id) return
    chapters.value = await getChaptersByNovelId(id)
    chapters.value.sort((a, b) => a.index - b.index)
    chapterIndex.value = 0
  },
  { immediate: true },
)

function prevChapter() {
  if (chapterIndex.value > 0) chapterIndex.value--
}

function nextChapter() {
  if (chapterIndex.value < chapters.value.length - 1) chapterIndex.value++
}

function onShowControls() {
  showControls.value = !showControls.value
}

let saveTimer: ReturnType<typeof setTimeout> | null = null

function updateSettings(s: ReaderSettings) {
  settings.value = s
  if (saveTimer) clearTimeout(saveTimer)
  saveTimer = setTimeout(async () => {
    const c = await getConfig()
    if (c) {
      c.readingSettings = { ...settings.value }
      saveConfig(c)
    }
  }, 300)
}

function onJumpToChapter(index: number) {
  if (mode.value === 'agent') mode.value = 'reader'
  chapterIndex.value = index
}

async function onChaptersChanged() {
  if (mode.value !== 'reader' || !storyId.value) return
  chapters.value = await getChaptersByNovelId(storyId.value)
  chapters.value.sort((a, b) => a.index - b.index)
}
</script>

<template>
  <div class="relative h-full flex flex-col overflow-hidden">
    <div
      class="tab-panel"
      :class="mode === 'reader' ? 'tab-panel-active' : 'tab-panel-inactive'"
      :aria-hidden="mode !== 'reader'"
    >
      <ReaderView
        key="reader"
        :content="currentChapter?.content ?? t('story.noContent')"
        :title="currentChapter?.title ?? t('story.untitled')"
        :chapter-index="chapterIndex"
        :total-chapters="totalChapters"
        :settings="settings"
        @prev-chapter="prevChapter"
        @next-chapter="nextChapter"
        @show-controls="onShowControls"
        @update-progress="() => {}"
      />
    </div>
    <div
      class="tab-panel"
      :class="mode === 'agent' ? 'tab-panel-active' : 'tab-panel-inactive'"
      :aria-hidden="mode !== 'agent'"
    >
      <AgentChat
        :key="`agent:${storyId}`"
        :novel-id="storyId"
        @chapters-changed="onChaptersChanged"
      />
    </div>

    <!-- Bottom controls sheet -->
    <Transition name="controls-slide">
      <ReaderControls
        v-if="mode === 'reader' && showControls"
        class="absolute inset-x-0 bottom-0 z-10"
        :settings="settings"
        :chapter-index="chapterIndex"
        :total-chapters="totalChapters"
        @update:settings="updateSettings"
        @close="showControls = false"
      />
    </Transition>

    <NovelDataDrawer
      v-model:open="dataDrawerOpen"
      :novel-id="storyId"
      @jump-to-chapter="onJumpToChapter"
    />
  </div>
</template>

<style scoped>
.controls-slide-enter-active,
.controls-slide-leave-active {
  transition:
    transform 0.3s ease,
    opacity 0.3s ease;
}
.controls-slide-enter-from,
.controls-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}

/* Tab panel transitions — pure crossfade */
.tab-panel {
  position: absolute;
  inset: 0;
  will-change: opacity;
}

.tab-panel-active {
  opacity: 1;
  z-index: 2;
  transition: opacity 0.25s cubic-bezier(0.65, 0, 0.35, 1);
}

.tab-panel-inactive {
  opacity: 0;
  z-index: 1;
  pointer-events: none;
  transition: opacity 0.2s cubic-bezier(0.65, 0, 0.35, 1);
}
</style>
