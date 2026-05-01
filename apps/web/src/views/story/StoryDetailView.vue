<script setup lang="ts">
import { ref, computed, inject, h, onMounted, onUnmounted } from 'vue'
import { useRoute } from 'vue-router'
import { MessageCircle, BookOpen } from 'lucide-vue-next'
import ReaderView from '@/components/reader/ReaderView.vue'
import ReaderControls from '@/components/reader/ReaderControls.vue'
import AgentChat from './components/AgentChat.vue'
import type { ReaderSettings } from '@/components/reader/types'
import type { Component } from 'vue'

const route = useRoute()
const storyId = computed(() => route.params.id as string)

const mode = ref<'reader' | 'agent'>(
  route.query.new !== undefined ? 'agent' : 'reader'
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

// Placeholder data — will be replaced with IndexedDB reads
const currentChapter = computed(() => ({
  index: 0,
  title: '第一章',
  content: '<p>故事内容加载中...</p>',
}))

const totalChapters = 1

function onShowControls() {
  showControls.value = !showControls.value
}

function updateSettings(s: ReaderSettings) {
  settings.value = s
}
</script>

<template>
    <div class="h-full flex flex-col overflow-hidden">
    <!-- Reader mode -->
    <ReaderView
      v-if="mode === 'reader'"
      :content="currentChapter.content"
      :title="currentChapter.title"
      :chapter-index="currentChapter.index"
      :total-chapters="totalChapters"
      :settings="settings"
      @prev-chapter="() => {}"
      @next-chapter="() => {}"
      @show-controls="onShowControls"
      @update-progress="() => {}"
    />

    <!-- Agent mode -->
    <AgentChat v-else :novel-id="storyId" />

    <!-- Bottom controls sheet -->
    <Transition name="controls-slide">
      <ReaderControls
        v-if="mode === 'reader' && showControls"
        :settings="settings"
        :chapter-index="currentChapter.index"
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
