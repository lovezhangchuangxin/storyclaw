import type { ToolContext, ToolDefinition } from './types'
import { createOutlineTools } from './outline'
import { createCharacterTools } from './characters'
import { createChapterTools } from './chapters'
import { createWorldBuildingTools } from './worldBuilding'
import { createStyleTools } from './style'
import { createStoryManagementTools } from './story'

let cachedMap: Map<string, ToolDefinition> | null = null

export function getToolRegistry(context: ToolContext): Map<string, ToolDefinition> {
  if (cachedMap) return cachedMap

  const tools: ToolDefinition[] = [
    ...createOutlineTools(context),
    ...createCharacterTools(context),
    ...createChapterTools(context),
    ...createWorldBuildingTools(context),
    ...createStyleTools(context),
    ...createStoryManagementTools(context),
  ]

  cachedMap = new Map(tools.map((t) => [t.name, t]))
  return cachedMap
}

/** Reset cache (useful for testing or when context changes) */
export function clearToolRegistryCache(): void {
  cachedMap = null
}
