<script setup lang="ts">
import { ref, h, onMounted, onUnmounted, inject } from 'vue'
import { BookOpen, MessageCircle } from 'lucide-vue-next'
import { createNovel } from '@/db/novels'
import type { Novel } from '@/db/types'
import type { Component } from 'vue'
import AgentChat from '@/views/story/components/AgentChat.vue'
import ReaderTab from './components/ReaderTab.vue'

const setTopbarExtra = inject<(c: Component | null) => void>('setTopbarExtra')

const mode = ref<'agent' | 'reader'>('agent')
const novelId = ref('')

onMounted(async () => {
  const id = crypto.randomUUID()
  const novel: Novel = {
    id,
    title: '新故事',
    synopsis: '',
    genre: '',
    targetWordCount: 0,
    currentWordCount: 0,
    status: 'drafting' as const,
    styleSettings: { narrativePerspective: '', tense: '', languageStyle: '' },
    createdAt: Date.now(),
    updatedAt: Date.now(),
    version: 1,
  }
  await createNovel(novel)
  novelId.value = id

  setTopbarExtra?.({
    setup() {
      return () => h('button', {
        class: 'size-8 flex items-center justify-center rounded-md hover:bg-muted shrink-0 cursor-pointer',
        onClick: () => { mode.value = mode.value === 'agent' ? 'reader' : 'agent' },
        title: mode.value === 'agent' ? '阅读模式' : '创作模式',
      }, [
        h(mode.value === 'agent' ? BookOpen : MessageCircle, { class: 'size-5' }),
      ])
    },
  })
})

onUnmounted(() => {
  setTopbarExtra?.(null)
})
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <KeepAlive>
      <AgentChat v-if="mode === 'agent'" :key="novelId" :novel-id="novelId" />
      <ReaderTab v-else :key="novelId" :novel-id="novelId" />
    </KeepAlive>
  </div>
</template>
