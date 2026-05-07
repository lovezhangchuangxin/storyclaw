<script setup lang="ts">
import { ref, inject, onMounted, onUnmounted, watch, type Component } from 'vue'
import { useRoute } from 'vue-router'
import { h } from 'vue'
import { PanelRight } from 'lucide-vue-next'
import { getRoleplaySessionById } from '@/db/roleplay-sessions'
import { getPromptById } from '@/db/prompts'
import type { RoleplaySidebarData } from '@/db/roleplay-types'
import RoleplayChat from './components/RoleplayChat.vue'
import SceneSidebar from './components/SceneSidebar.vue'

const route = useRoute()
const sessionId = ref(route.params.id as string)

const sessionTitle = ref('')
const sidebarOpen = ref(false)
const sidebarData = ref<RoleplaySidebarData | null>(null)

const setTitle = inject<(t: string | null) => void>('setTitle')
const setTopbarExtra = inject<(c: Component | null) => void>('setTopbarExtra')

function toggleSidebar() {
  sidebarOpen.value = !sidebarOpen.value
}

function handleSidebarUpdate(data: RoleplaySidebarData) {
  sidebarData.value = data
}

function injectTopbar() {
  setTopbarExtra?.({
    setup() {
      return () =>
        h(
          'button',
          {
            class: `size-8 flex items-center justify-center rounded-md hover:bg-muted shrink-0 transition-colors ${sidebarOpen.value ? 'text-foreground bg-muted' : 'text-muted-foreground'}`,
            'aria-label': 'Toggle sidebar',
            onClick: toggleSidebar,
          },
          [h(PanelRight, { class: 'size-4' })],
        )
    },
  })
}

async function loadSession() {
  const session = await getRoleplaySessionById(sessionId.value)
  if (session) {
    sessionTitle.value = session.title
    sidebarData.value = session.sidebarData
    const prompt = await getPromptById(session.promptId)
    if (prompt && !sessionTitle.value) {
      sessionTitle.value = prompt.name
    }
    setTitle?.(sessionTitle.value || '')
  }
}

onMounted(() => {
  loadSession()
  injectTopbar()
})

onUnmounted(() => {
  setTopbarExtra?.(null)
  setTitle?.(null)
})

watch(
  () => route.params.id,
  (newId) => {
    if (newId && typeof newId === 'string') {
      sessionId.value = newId
      sidebarOpen.value = false
      loadSession()
    }
  },
)
</script>

<template>
  <div class="relative h-full">
    <!-- Chat (full width) -->
    <RoleplayChat :key="sessionId" :session-id="sessionId" @sidebar-update="handleSidebarUpdate" />

    <!-- Sidebar overlay -->
    <Transition
      enter-active-class="transition-opacity duration-200 ease-out"
      enter-from-class="opacity-0"
      enter-to-class="opacity-100"
      leave-active-class="transition-opacity duration-150 ease-in"
      leave-from-class="opacity-100"
      leave-to-class="opacity-0"
    >
      <div v-if="sidebarOpen" class="absolute inset-0 z-20 flex justify-end">
        <div class="absolute inset-0 bg-black/20" @click="sidebarOpen = false" />
        <div class="relative w-72 bg-card border-l shadow-lg">
          <SceneSidebar :data="sidebarData" />
        </div>
      </div>
    </Transition>
  </div>
</template>
