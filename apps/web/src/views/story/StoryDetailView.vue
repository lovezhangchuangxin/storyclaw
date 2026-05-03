<script setup lang="ts">
import { ref, computed, inject, h, watch, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { MessageCircle, BookOpen } from 'lucide-vue-next'
import ReaderView from '@/components/reader/ReaderView.vue'
import ReaderControls from '@/components/reader/ReaderControls.vue'
import AgentChat from './components/AgentChat.vue'
import { getChaptersByNovelId } from '@/db/chapters'
import type { ReaderSettings } from '@/components/reader/types'
import type { Chapter } from '@/db/types'
import type { Component } from 'vue'

const route = useRoute()
const storyId = computed(() => route.params.id as string)

const mode = ref<'reader' | 'agent'>(
  route.query.tab === 'agent' ? 'agent' : 'reader'
)
const showControls = ref(false)

const setTopbarExtra = inject<(c: Component | null) => void>('setTopbarExtra')

onMounted(() => {
  setTopbarExtra?.({
    setup() {
      return () => h('button', {
        class: 'size-8 flex items-center justify-center rounded-md hover:bg-muted shrink-0',
        onClick: () => { mode.value = mode.value === 'reader' ? 'agent' : 'reader' },
      }, [
        h(mode.value === 'reader' ? BookOpen : MessageCircle, { class: 'size-5' }),
      ])
    },
  })
})

onUnmounted(() => {
  setTopbarExtra?.(null)
})

const settings = ref<ReaderSettings>({
  fontFamily: '"Noto Sans SC", Inter, system-ui, sans-serif',
  fontSize: 18,
  lineHeight: 1.8,
  paragraphSpacing: 1,
  textColor: '#333333',
  backgroundColor: '#F5F0E8',
  scrollMode: 'scroll',
  autoScrollSpeed: 50,
})

const chapters = ref<Chapter[]>([])
const chapterIndex = ref(0)

const currentChapter = computed(() => chapters.value[chapterIndex.value])
const totalChapters = computed(() => chapters.value.length)

watch(storyId, async (id) => {
  if (!id) return
  chapters.value = await getChaptersByNovelId(id)
  chapters.value.sort((a, b) => a.index - b.index)
  chapterIndex.value = 0
}, { immediate: true })

function prevChapter() {
  if (chapterIndex.value > 0) chapterIndex.value--
}

function nextChapter() {
  if (chapterIndex.value < chapters.value.length - 1) chapterIndex.value++
}

function onShowControls() {
  showControls.value = !showControls.value
}

function updateSettings(s: ReaderSettings) {
  settings.value = s
}
</script>

<template>
  <div class="relative h-full flex flex-col overflow-hidden">
    <div
      class="absolute inset-0 transition-[visibility]"
      :class="mode === 'reader' ? 'visible' : 'invisible pointer-events-none'"
      :aria-hidden="mode !== 'reader'"
    >
      <ReaderView
        key="reader"
        :content="currentChapter?.content ?? '<p>暂无内容</p>'"
        :title="currentChapter?.title ?? '无标题'"
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
      class="absolute inset-0 transition-[visibility]"
      :class="mode === 'agent' ? 'visible' : 'invisible pointer-events-none'"
      :aria-hidden="mode !== 'agent'"
    >
      <AgentChat
        :key="`agent:${storyId}`"
        :novel-id="storyId"
      />
    </div>

    <!-- Bottom controls sheet -->
    <Transition name="controls-slide">
      <ReaderControls
        v-if="mode === 'reader' && showControls"
        :settings="settings"
        :chapter-index="chapterIndex"
        :total-chapters="totalChapters"
        @update:settings="updateSettings"
        @close="showControls = false"
      />
    </Transition>
  </div>
</template>

<style scoped>
.controls-slide-enter-active,
.controls-slide-leave-active {
  transition: transform 0.3s ease, opacity 0.3s ease;
}
.controls-slide-enter-from,
.controls-slide-leave-to {
  transform: translateY(100%);
  opacity: 0;
}
</style>
