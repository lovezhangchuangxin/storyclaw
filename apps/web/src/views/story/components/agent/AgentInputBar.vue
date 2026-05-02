<script setup lang="ts">
import { ChevronDown, Loader2, Send, Square, BrainCircuit } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { modelLabel } from '@/lib/model-utils'
import type { ModelConfig } from '@/db/types'

defineProps<{
  modelValue: string
  models: ModelConfig[]
  selectedModelId: string
  isGenerating: boolean
  isCompacting: boolean
  selectedModelLabel: string
  selectedModelProvider: string
}>()

const emit = defineEmits<{
  'update:modelValue': [value: string]
  send: []
  cancel: []
  compact: []
  'update:selectedModelId': [id: string]
}>()
</script>

<template>
  <div class="shrink-0 bg-background">
    <div class="mx-auto max-w-3xl px-4 pb-4 pt-2">
      <div
        class="rounded-lg border bg-card shadow-lg transition-all focus-within:border-ring/50 focus-within:shadow-xl dark:bg-card"
      >
        <textarea
          :value="modelValue"
          @input="emit('update:modelValue', ($event.target as HTMLTextAreaElement).value)"
          placeholder="输入你的想法或反馈... (Ctrl+Enter 发送)"
          rows="1"
          class="field-sizing-content block min-h-0 w-full resize-none bg-transparent px-4 py-3.5 text-base outline-none placeholder:text-muted-foreground/60 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
          :disabled="isGenerating"
          @keydown.enter.exact.prevent="emit('send')"
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
            <span>配置模型</span>
          </router-link>

          <!-- Compact context -->
          <Button
            variant="ghost"
            size="xs"
            class="text-xs text-muted-foreground hover:text-foreground"
            :disabled="isGenerating || isCompacting || models.length === 0"
            @click="emit('compact')"
          >
            <Loader2 v-if="isCompacting" class="mr-1 size-3 animate-spin" />
            <span>整理上下文</span>
          </Button>

          <div class="ml-auto flex items-center gap-1">
            <Button
              v-if="!isGenerating"
              size="icon-sm"
              variant="default"
              class="bg-primary/90 hover:bg-primary"
              :disabled="!modelValue.trim()"
              @click="emit('send')"
            >
              <Send class="size-3.5" />
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
