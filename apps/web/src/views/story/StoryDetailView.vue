<script setup lang="ts">
import { ref, computed } from 'vue'
import { useRouter } from 'vue-router'
import { ArrowLeft, MessageCircle, BookOpen } from 'lucide-vue-next'
import ReaderView from '@/components/reader/ReaderView.vue'
import ReaderControls from '@/components/reader/ReaderControls.vue'
import AgentChat from './components/AgentChat.vue'
import type { ReaderSettings } from '@/components/reader/types'

const router = useRouter()
const storyId = 'new'

const mode = ref<'reader' | 'agent'>('reader')
const showControls = ref(false)
const showChapters = ref(false)

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
  <div class="flex flex-col h-dvh">
    <!-- Top bar -->
    <header class="flex items-center justify-between shrink-0 px-3 py-2 border-b bg-background">
      <button class="size-8 flex items-center justify-center" @click="router.back()">
        <ArrowLeft class="size-5" />
      </button>
      <span class="text-sm font-medium truncate">故事标题</span>
      <button
        class="size-8 flex items-center justify-center"
        @click="mode = mode === 'reader' ? 'agent' : 'reader'"
      >
        <BookOpen v-if="mode === 'reader'" class="size-5" />
        <MessageCircle v-else class="size-5" />
      </button>
    </header>

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
    <ReaderControls
      v-if="mode === 'reader' && showControls"
      :settings="settings"
      :chapter-index="currentChapter.index"
      :total-chapters="totalChapters"
      @update:settings="updateSettings"
      @open-chapters="showChapters = true"
      @close="showControls = false"
    />
  </div>
</template>
