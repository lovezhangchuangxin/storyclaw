import { z } from 'zod'
import type { ToolContext, ToolDefinition } from './types'
import { getRoleplaySessionById, saveRoleplaySession } from '@/db/roleplay-sessions'
import type { RoleplaySidebarGroup } from '@/db/roleplay-types'

export function createRoleplayTools(context: ToolContext): ToolDefinition[] {
  return [renderMessageTool(context), renderChoiceTool(context), updateSidebarTool(context)]
}

function renderMessageTool(_context: ToolContext): ToolDefinition {
  return {
    name: 'render_message',
    displayName: 'roleplay.tool.renderMessage',
    icon: '💬',
    description: 'roleplay.tool.renderMessageDesc',
    parameters: {
      type: 'object',
      properties: {
        messages: {
          type: 'array',
          description: 'Array of messages to render in the conversation flow',
          items: {
            type: 'object',
            properties: {
              role: {
                type: 'string',
                enum: ['narrator', 'character', 'system'],
                description:
                  'narrator (旁白/description), character (角色台词/dialogue), system (系统提示/scene transition)',
              },
              characterName: {
                type: 'string',
                description: 'Character name (required when role=character)',
              },
              content: {
                type: 'string',
                description: 'Message text content',
              },
              emote: {
                type: 'string',
                description: 'Optional stage direction (e.g. *smiles*, *draws sword*)',
              },
            },
            required: ['role', 'content'],
          },
        },
      },
      required: ['messages'],
    },
    validationSchema: z.object({
      messages: z
        .array(
          z
            .object({
              role: z.enum(['narrator', 'character', 'system']),
              characterName: z.string().optional(),
              content: z.string().min(1),
              emote: z.string().optional(),
            })
            .refine((msg) => msg.role !== 'character' || msg.characterName, {
              message: 'characterName is required when role=character',
            }),
        )
        .min(1),
    }),
    async execute(args) {
      return { success: true, count: (args.messages as unknown[]).length }
    },
  }
}

function renderChoiceTool(_context: ToolContext): ToolDefinition {
  return {
    name: 'render_choice',
    displayName: 'roleplay.tool.renderChoice',
    icon: '🎯',
    description: 'roleplay.tool.renderChoiceDesc',
    parameters: {
      type: 'object',
      properties: {
        prompt: {
          type: 'string',
          description: 'Text to display above the choices (e.g. "What do you do?")',
        },
        choices: {
          type: 'array',
          description: 'Available choices for the user',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Unique choice identifier' },
              text: { type: 'string', description: 'Choice display text' },
              description: {
                type: 'string',
                description: 'Optional short description of the choice',
              },
            },
            required: ['id', 'text'],
          },
        },
        allowFreeText: {
          type: 'boolean',
          description:
            'Whether user can type free text instead of picking a choice (default: true)',
          default: true,
        },
      },
      required: ['prompt', 'choices'],
    },
    validationSchema: z.object({
      prompt: z.string().min(1),
      choices: z
        .array(
          z.object({
            id: z.string().min(1),
            text: z.string().min(1),
            description: z.string().optional(),
          }),
        )
        .min(1),
      allowFreeText: z.boolean().optional().default(true),
    }),
    async execute(args) {
      return { success: true, choiceCount: (args.choices as unknown[]).length, pending: true }
    },
  }
}

function updateSidebarTool(context: ToolContext): ToolDefinition {
  return {
    name: 'update_sidebar',
    displayName: 'roleplay.tool.updateSidebar',
    icon: '📋',
    description: 'roleplay.tool.updateSidebarDesc',
    parameters: {
      type: 'object',
      properties: {
        groups: {
          type: 'array',
          description: 'Sidebar data organized as groups of fields',
          items: {
            type: 'object',
            properties: {
              id: { type: 'string', description: 'Group identifier' },
              title: { type: 'string', description: 'Group display title' },
              fields: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    key: { type: 'string', description: 'Field key' },
                    label: { type: 'string', description: 'Field display label' },
                    value: { type: 'string', description: 'Field value' },
                    type: {
                      type: 'string',
                      enum: ['text', 'number', 'badge'],
                      description: 'Display type (default: text)',
                    },
                  },
                  required: ['key', 'label', 'value'],
                },
              },
            },
            required: ['id', 'title', 'fields'],
          },
        },
      },
      required: ['groups'],
    },
    validationSchema: z.object({
      groups: z.array(
        z.object({
          id: z.string().min(1),
          title: z.string().min(1),
          fields: z.array(
            z.object({
              key: z.string().min(1),
              label: z.string().min(1),
              value: z.string(),
              type: z.enum(['text', 'number', 'badge']).optional(),
            }),
          ),
        }),
      ),
    }),
    async execute(args) {
      if (!context.sessionId) {
        return { success: false, error: 'No active session' }
      }
      const sessionId = context.sessionId
      const session = await getRoleplaySessionById(sessionId)
      if (session) {
        session.sidebarData = { groups: args.groups as RoleplaySidebarGroup[] }
        session.updatedAt = Date.now()
        await saveRoleplaySession(session)
      }
      return { success: true }
    },
  }
}
