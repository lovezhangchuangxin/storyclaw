<script setup lang="ts">
import { ref, h, onMounted, onUnmounted, inject } from 'vue'
import { BookOpen, MessageCircle } from 'lucide-vue-next'
import type { Component } from 'vue'
import AgentChat from '@/views/story/components/AgentChat.vue'
import ReaderTab from './components/ReaderTab.vue'

const setTopbarExtra = inject<(c: Component | null) => void>('setTopbarExtra')

const mode = ref<'agent' | 'reader'>('agent')
const novelId = ref('')

onMounted(() => {
  novelId.value = crypto.randomUUID()

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
