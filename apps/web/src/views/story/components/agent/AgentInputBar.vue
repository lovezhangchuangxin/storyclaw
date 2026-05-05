<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { useI18n } from 'vue-i18n'
import { ChevronDown, Send, Square, BrainCircuit, Play, Search } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import type { ModelConfig } from '@/db/types'
import { SLASH_COMMANDS, COMMAND_IDS } from '@/agent/commands'
import { modelLabel } from '@/lib/model-utils'
import ContextWindowIndicator from './ContextWindowIndicator.vue'

const props = defineProps<{
  modelValue: string
  models: ModelConfig[]
  selectedModelId: string
  isGenerating: boolean
  selectedModelLabel: string
  selectedModelProvider: string
  contextUsedTokens: number
  contextWindowTokens: number
  outputReserveTokens: number
  compactionTriggerRatio: number
  contextMessageCount: number
  contextIsEstimated: boolean
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  cancel: []
  'update:selectedModelId': [id: string]
  command: [cmdId: string]
}>()

const { t } = useI18n()

const showCommandMenu = ref(false)
const commandInputRef = ref<HTMLInputElement>()
const inputAreaRef = ref<HTMLElement>()
const panelStyle = ref<Record<string, string>>({})
const activeIndex = ref(0)
const commandSearch = ref('')

const filteredCommandList = computed(() => {
  if (!commandSearch.value) return SLASH_COMMANDS
  const q = commandSearch.value.toLowerCase()
  return SLASH_COMMANDS.filter(
    (cmd) => cmd.label.toLowerCase().includes(q) || cmd.description.toLowerCase().includes(q),
  )
})

watch(filteredCommandList, () => {
  activeIndex.value = 0
})

function updatePanelPosition() {
  if (!inputAreaRef.value) return
  const rect = inputAreaRef.value.getBoundingClientRect()
  panelStyle.value = {
    position: 'fixed',
    bottom: `${window.innerHeight - rect.top + 8}px`,
    left: `${rect.left}px`,
    width: `${rect.width}px`,
  }
}

watch(
  () => props.modelValue,
  (val) => {
    if (val === '/') {
      showCommandMenu.value = true
      commandSearch.value = ''
      activeIndex.value = 0
      emit('update:modelValue', '')
      nextTick(() => {
        updatePanelPosition()
      })
      setTimeout(() => {
        commandInputRef.value?.focus()
      })
    }
  },
)

function selectCommand(cmdId: string) {
  showCommandMenu.value = false
  activeIndex.value = 0
  commandSearch.value = ''
  emit('update:modelValue', `/${cmdId} `)
}

function closeCommandMenu() {
  showCommandMenu.value = false
  activeIndex.value = 0
  commandSearch.value = ''
}

function handleCommandKeydown(e: KeyboardEvent) {
  const list = filteredCommandList.value
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    activeIndex.value = list.length ? (activeIndex.value + 1) % list.length : 0
  } else if (e.key === 'ArrowUp') {
    e.preventDefault()
    activeIndex.value = list.length ? (activeIndex.value - 1 + list.length) % list.length : 0
  } else if (e.key === 'Enter') {
    e.preventDefault()
    const cmd = list[activeIndex.value]
    if (cmd) selectCommand(cmd.id)
  } else if (e.key === 'Escape') {
    e.preventDefault()
    closeCommandMenu()
  }
}

const pendingCommandId = computed(() => {
  const token = props.modelValue.trim().split(' ')[0]
  if (!token.startsWith('/')) return null
  const id = token.slice(1)
  return COMMAND_IDS.has(id) ? id : null
})

function handleSend() {
  if (pendingCommandId.value) {
    emit('update:modelValue', '')
    emit('command', pendingCommandId.value)
  } else {
    emit('send')
  }
}
</script>

<template>
  <div class="shrink-0 bg-background/90 backdrop-blur-sm">
    <div class="mx-auto max-w-3xl px-4 pb-4 pt-2 relative">
      <!-- Slash Command Menu -->
      <Teleport to="body">
        <Transition
          enter-active-class="transition duration-150 ease-out"
          enter-from-class="opacity-0 translate-y-1"
          enter-to-class="opacity-100 translate-y-0"
          leave-active-class="transition duration-100 ease-in"
          leave-from-class="opacity-100 translate-y-0"
          leave-to-class="opacity-0 translate-y-1"
        >
          <div
            v-if="showCommandMenu"
            class="fixed inset-0 z-50"
            @mousedown="closeCommandMenu"
            @touchstart="closeCommandMenu"
          >
            <div :style="panelStyle" @click.stop @mousedown.stop @touchstart.stop>
              <div class="rounded-lg border bg-popover shadow-lg overflow-hidden">
                <div class="flex items-center gap-2 px-3 py-2 border-b">
                  <Search class="size-4 shrink-0 text-muted-foreground" />
                  <input
                    ref="commandInputRef"
                    v-model="commandSearch"
                    :placeholder="t('story.agent.searchCommands')"
                    class="w-full bg-transparent text-sm outline-none placeholder:text-muted-foreground"
                    @keydown="handleCommandKeydown"
                  />
                </div>
                <div class="p-1">
                  <div
                    v-for="(cmd, index) in filteredCommandList"
                    :key="cmd.id"
                    class="flex items-center gap-2 rounded-md px-2 py-1.5 text-sm cursor-pointer transition-colors"
                    :class="index === activeIndex ? 'bg-accent text-accent-foreground' : ''"
                    @click="selectCommand(cmd.id)"
                    @mouseenter="activeIndex = index"
                  >
                    <component :is="cmd.icon" class="size-4 shrink-0 text-muted-foreground" />
                    <span class="font-medium">{{ cmd.label }}</span>
                    <span class="text-muted-foreground">—</span>
                    <span class="text-muted-foreground">{{ cmd.description }}</span>
                  </div>
                  <div
                    v-if="filteredCommandList.length === 0"
                    class="px-2 py-1.5 text-sm text-muted-foreground"
                  >
                    {{ t('story.agent.noMatchingCommand') }}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </Teleport>

      <!-- Input Area -->
      <div
        ref="inputAreaRef"
        class="rounded-lg border bg-card shadow-lg transition-all focus-within:border-ring/50 focus-within:shadow-xl dark:bg-card"
      >
        <textarea
          :value="modelValue"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          :placeholder="t('story.agent.inputPlaceholder')"
          rows="1"
          class="field-sizing-content block min-h-0 w-full resize-none bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          :disabled="isGenerating"
          @keydown.enter.exact.prevent="handleSend"
        />

        <div class="flex items-center gap-2 px-3 pb-3">
          <!-- Model selector -->
          <DropdownMenu v-if="models.length > 0">
            <DropdownMenuTrigger
              as="button"
              class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <span
                class="flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70"
              >
                {{ selectedModelProvider }}
              </span>
              <span class="max-w-[120px] truncate">{{ selectedModelLabel }}</span>
              <ChevronDown class="size-3 shrink-0" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" class="min-w-[200px]">
              <DropdownMenuItem
                v-for="model in models"
                :key="model.id"
                class="flex items-center gap-2"
                @click="emit('update:selectedModelId', model.id)"
              >
                <span
                  class="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70"
                >
                  {{ model.provider[0]?.toUpperCase() }}
                </span>
                <span class="text-xs">{{ modelLabel(model) }}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <!-- "配置模型" link when no models -->
          <router-link
            v-else
            :to="{ name: 'model-config' }"
            class="flex items-center gap-1.5 rounded-lg px-2 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <BrainCircuit class="size-3.5" />
            <span>{{ t('story.agent.configureModel') }}</span>
          </router-link>

          <div class="ml-auto flex items-center gap-1">
            <ContextWindowIndicator
              :used-tokens="contextUsedTokens"
              :context-window-tokens="contextWindowTokens"
              :output-reserve-tokens="outputReserveTokens"
              :compaction-trigger-ratio="compactionTriggerRatio"
              :message-count="contextMessageCount"
              :is-estimated="contextIsEstimated"
            />
            <Button
              v-if="!isGenerating"
              size="sm"
              variant="default"
              class="gap-1.5"
              :disabled="!modelValue.trim()"
              @click="handleSend"
            >
              <Play v-if="pendingCommandId" class="size-3.5" />
              <Send v-else class="size-3.5" />
              {{ pendingCommandId ? t('story.agent.execute') : t('story.agent.send') }}
            </Button>
            <Button v-else variant="destructive" size="icon-sm" @click="emit('cancel')">
              <Square class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
