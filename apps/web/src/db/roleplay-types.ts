import type { Message } from './types'

export interface RoleplaySession {
  id: string
  promptId: string
  title: string
  sidebarData: RoleplaySidebarData | null
  createdAt: number
  updatedAt: number
}

export interface RoleplaySidebarData {
  groups: RoleplaySidebarGroup[]
}

export interface RoleplaySidebarGroup {
  id: string
  title: string
  fields: RoleplaySidebarField[]
}

export interface RoleplaySidebarField {
  key: string
  label: string
  value: string
  type?: 'text' | 'number' | 'badge'
}

export interface RoleplayConversation {
  sessionId: string
  messages: Message[]
  updatedAt: number
}
