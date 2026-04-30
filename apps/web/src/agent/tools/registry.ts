import type { ToolContext, ToolDefinition } from './types'
import { createOutlineTools } from './outline'
import { createCharacterTools } from './characters'
import { createChapterTools } from './chapters'
import { createWorldBuildingTools } from './worldBuilding'
import { createStyleTools } from './style'
import { createStoryManagementTools } from './story'

export function getAllTools(context: ToolContext): ToolDefinition[] {
  return [
    ...createOutlineTools(context),
    ...createCharacterTools(context),
    ...createChapterTools(context),
    ...createWorldBuildingTools(context),
    ...createStyleTools(context),
    ...createStoryManagementTools(context),
  ]
}
