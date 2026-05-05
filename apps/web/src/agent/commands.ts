import type { Component } from 'vue'
import { Zap, RefreshCw } from 'lucide-vue-next'
import { i18n } from '@/i18n'

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
    get description() {
      return i18n.global.t('agent.compaction.command')
    },
    icon: Zap,
  },
  {
    id: 'new',
    label: '/new',
    get description() {
      return i18n.global.t('agent.newSession.command')
    },
    icon: RefreshCw,
  },
]

export const COMMAND_IDS = new Set(SLASH_COMMANDS.map((cmd) => cmd.id))
