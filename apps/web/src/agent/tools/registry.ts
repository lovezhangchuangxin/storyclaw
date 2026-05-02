import type { ToolContext, ToolDefinition } from './types'
import { createOutlineTools } from './outline'
import { createCharacterTools } from './characters'
import { createChapterTools } from './chapters'
import { createWorldBuildingTools } from './worldBuilding'
import { createStyleTools } from './style'
import { createStoryManagementTools } from './story'

export function getToolRegistry(context: ToolContext): Map<string, ToolDefinition> {
  const tools: ToolDefinition[] = [
    ...createOutlineTools(context),
    ...createCharacterTools(context),
    ...createChapterTools(context),
    ...createWorldBuildingTools(context),
    ...createStyleTools(context),
    ...createStoryManagementTools(context),
  ]

  const map = new Map<string, ToolDefinition>()
  for (const tool of tools) {
    if (map.has(tool.name)) {
      console.warn(`[ToolRegistry] Duplicate tool name: "${tool.name}" — overwriting previous definition`)
    }
    map.set(tool.name, tool)
  }
  return map
}

/** Kept for backward compatibility; no longer needed since registry is stateless. */
export function clearToolRegistryCache(): void {
  /* no-op */
}
