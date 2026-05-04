import type { Component } from 'vue'
import { Zap } from 'lucide-vue-next'

export interface SlashCommand {
  id: string
  label: string
  description: string
  icon: Component
}

export const SLASH_COMMANDS: SlashCommand[] = [
  {
    id: 'compact',
    label: '/compact',
    description: '整理上下文，压缩对话历史',
    icon: Zap,
  },
]

export const COMMAND_IDS = new Set(SLASH_COMMANDS.map(cmd => cmd.id))
