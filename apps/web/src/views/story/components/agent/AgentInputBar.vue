<script setup lang="ts">
import { ref, watch, nextTick, computed } from 'vue'
import { ChevronDown, Send, Square, BrainCircuit, Play } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command'
import type { ModelConfig } from '@/db/types'
import { SLASH_COMMANDS, COMMAND_IDS } from '@/agent/commands'

const props = defineProps<{
  modelValue: string
  models: ModelConfig[]
  selectedModelId: string
  isGenerating: boolean
  selectedModelLabel: string
  selectedModelProvider: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  cancel: []
  'update:selectedModelId': [id: string]
  command: [cmdId: string]
}>()

const showCommandMenu = ref(false)
const commandRef = ref<InstanceType<typeof Command>>()
const inputAreaRef = ref<HTMLElement>()
const panelStyle = ref<Record<string, string>>({})

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

watch(() => props.modelValue, (val) => {
  if (val === '/') {
    showCommandMenu.value = true
    emit('update:modelValue', '')
    nextTick(() => {
      updatePanelPosition()
      const input = commandRef.value?.$el?.querySelector('input')
      input?.focus()
    })
  }
})

function selectCommand(cmdId: string) {
  showCommandMenu.value = false
  emit('update:modelValue', `/${cmdId} `)
}

function closeCommandMenu() {
  showCommandMenu.value = false
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
  }
  else {
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
          <div v-if="showCommandMenu" class="fixed inset-0 z-50" @mousedown="closeCommandMenu" @touchstart="closeCommandMenu">
            <div
              :style="panelStyle"
              @click.stop @mousedown.stop @touchstart.stop
            >
              <div class="rounded-lg border bg-popover p-0 shadow-lg overflow-hidden">
                <Command ref="commandRef">
                  <CommandInput placeholder="搜索命令..." @keydown.escape.prevent="closeCommandMenu" />
                  <CommandList>
                    <CommandEmpty>没有匹配的命令</CommandEmpty>
                    <CommandGroup>
                      <CommandItem
                        v-for="cmd in SLASH_COMMANDS"
                        :key="cmd.id"
                        :value="cmd.id"
                        @select="selectCommand(cmd.id)"
                      >
                        <component :is="cmd.icon" class="size-4 shrink-0 text-muted-foreground" />
                        <div class="flex items-center gap-2">
                          <span class="font-medium">{{ cmd.label }}</span>
                          <span class="text-muted-foreground">—</span>
                          <span class="text-muted-foreground">{{ cmd.description }}</span>
                        </div>
                      </CommandItem>
                    </CommandGroup>
                  </CommandList>
                </Command>
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
          placeholder="发送消息，/ 命令"
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
              <span class="flex size-4 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70">
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
                <span class="flex size-5 items-center justify-center rounded bg-primary/10 text-[10px] font-semibold text-primary/70">
                  {{ model.provider[0]?.toUpperCase() }}
                </span>
                <span class="text-xs">{{ model.model }}</span>
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
            <span>配置模型</span>
          </router-link>

          <div class="ml-auto flex items-center gap-1">
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
              {{ pendingCommandId ? '执行' : '发送' }}
            </Button>
            <Button
              v-else
              variant="destructive"
              size="icon-sm"
              @click="emit('cancel')"
            >
              <Square class="size-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  </div>
</template>
