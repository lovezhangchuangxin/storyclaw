<script setup lang="ts">
import { ref, watch } from 'vue'
import {
  AccordionContent,
  AccordionHeader,
  AccordionItem,
  AccordionRoot,
  AccordionTrigger,
} from 'reka-ui'
import { AlertTriangle, ChevronDown } from 'lucide-vue-next'
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from '@/components/ui/sheet'
import { Badge } from '@/components/ui/badge'
import { getNovelById } from '@/db/novels'
import { getOutlineByNovelId } from '@/db/outlines'
import { getCharactersByNovelId } from '@/db/characters'
import { getWorldBuildingByNovelId } from '@/db/worldBuilding'
import type { Novel, Outline, Character, WorldBuilding } from '@/db/types'

const props = defineProps<{
  novelId: string
  open: boolean
}>()

const emit = defineEmits<{
  (e: 'update:open', val: boolean): void
}>()

const novel = ref<Novel | null>(null)
const outline = ref<Outline | null>(null)
const characters = ref<Character[]>([])
const worldBuilding = ref<WorldBuilding | null>(null)
const loading = ref(false)
const error = ref(false)
const expandedSections = ref<string[]>(['basic-info'])

let loadToken = 0

async function loadData() {
  if (!props.novelId) return
  loading.value = true
  error.value = false
  const token = ++loadToken
  try {
    const [n, o, cs, wb] = await Promise.all([
      getNovelById(props.novelId),
      getOutlineByNovelId(props.novelId),
      getCharactersByNovelId(props.novelId),
      getWorldBuildingByNovelId(props.novelId),
    ])
    if (token !== loadToken) return
    novel.value = n ?? null
    outline.value = o ?? null
    characters.value = cs
    worldBuilding.value = wb ?? null
  } catch {
    if (token !== loadToken) return
    error.value = true
  } finally {
    if (token === loadToken) {
      loading.value = false
    }
  }
}

watch(() => props.open, (val) => {
  if (val) {
    expandedSections.value = ['basic-info']
    loadData()
  }
})

const statusLabels: Record<string, string> = {
  drafting: '构思中',
  writing: '创作中',
  completed: '已完成',
  paused: '已暂停',
}

const chapterStatusLabels: Record<string, string> = {
  planned: '规划中',
  writing: '创作中',
  draft: '草稿',
  completed: '已完成',
}

const roleLabels: Record<string, string> = {
  protagonist: '主角',
  antagonist: '反派',
  supporting: '配角',
  minor: '次要',
}

function badgeClass(status: string): string {
  switch (status) {
    case 'completed': return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400'
    case 'writing':
    case 'draft': return 'bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400'
    case 'drafting':
    case 'planned': return 'bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400'
    case 'paused': return 'bg-muted text-muted-foreground'
    default: return ''
  }
}
</script>

<template>
  <Sheet :open="open" @update:open="emit('update:open', $event)">
    <SheetContent side="right" class="sm:max-w-md w-full">
      <template v-if="loading">
        <div class="flex items-center justify-center h-32 text-muted-foreground text-sm">
          加载中...
        </div>
      </template>

      <template v-else-if="error">
        <div class="flex flex-col items-center justify-center gap-3 h-32 text-muted-foreground text-sm">
          <AlertTriangle class="size-6 text-amber-500" />
          <span>数据加载失败</span>
        </div>
      </template>

      <template v-else-if="novel">
        <SheetHeader class="shrink-0">
          <SheetTitle>小说数据</SheetTitle>
          <SheetDescription>{{ novel.title }}</SheetDescription>
        </SheetHeader>

        <div class="flex-1 overflow-y-auto">
          <AccordionRoot
            type="multiple"
            v-model="expandedSections"
            class="w-full divide-y divide-border"
          >
            <!-- 基本信息 -->
            <AccordionItem value="basic-info" class="group">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group-data-[state=open]:bg-muted/30"
                >
                  <span class="flex items-center gap-2">
                    基本信息
                    <Badge :class="badgeClass(novel.status)" variant="outline" class="text-[10px]">
                      {{ statusLabels[novel.status] || novel.status }}
                    </Badge>
                  </span>
                  <ChevronDown class="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent class="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div class="px-4 pb-3 space-y-2 text-sm">
                  <p class="text-muted-foreground leading-relaxed">{{ novel.synopsis || '暂无简介' }}</p>
                  <div class="grid grid-cols-2 gap-x-4 gap-y-1 text-xs text-muted-foreground">
                    <div><span class="text-foreground/70">类型：</span>{{ novel.genre || '未设定' }}</div>
                    <div>
                      <span class="text-foreground/70">字数：</span>
                      {{ novel.currentWordCount.toLocaleString() }}
                      <template v-if="novel.targetWordCount">/ {{ novel.targetWordCount.toLocaleString() }}</template>
                    </div>
                    <div v-if="novel.styleSettings.narrativePerspective">
                      <span class="text-foreground/70">视角：</span>{{ novel.styleSettings.narrativePerspective }}
                    </div>
                    <div v-if="novel.styleSettings.tense">
                      <span class="text-foreground/70">时态：</span>{{ novel.styleSettings.tense }}
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- 风格设定 -->
            <AccordionItem v-if="novel.styleSettings.languageStyle || novel.styleSettings.customPrompt" value="style" class="group">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group-data-[state=open]:bg-muted/30"
                >
                  风格设定
                  <ChevronDown class="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent class="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div class="px-4 pb-3 space-y-2 text-xs text-muted-foreground">
                  <div v-if="novel.styleSettings.languageStyle">
                    <span class="text-foreground/70 font-medium">语言风格：</span>{{ novel.styleSettings.languageStyle }}
                  </div>
                  <div v-if="novel.styleSettings.customPrompt">
                    <span class="text-foreground/70 font-medium">自定义提示：</span>
                    <p class="mt-1 leading-relaxed whitespace-pre-wrap">{{ novel.styleSettings.customPrompt }}</p>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- 大纲 -->
            <AccordionItem v-if="outline" value="outline" class="group">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group-data-[state=open]:bg-muted/30"
                >
                  大纲
                  <ChevronDown class="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent class="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div class="px-4 pb-3 space-y-3 text-xs">
                  <div v-if="outline.premise">
                    <span class="text-foreground/70 font-medium">前提：</span>
                    <p class="mt-0.5 leading-relaxed text-muted-foreground">{{ outline.premise }}</p>
                  </div>
                  <div class="space-y-2">
                    <div
                      v-for="act in [
                        { key: 'act1', label: '第一幕', color: 'bg-amber-400' },
                        { key: 'act2', label: '第二幕', color: 'bg-blue-400' },
                        { key: 'act3', label: '第三幕', color: 'bg-emerald-400' },
                      ]"
                      :key="act.key"
                      class="rounded-md bg-muted/40 p-2.5"
                    >
                      <div class="flex items-center gap-1.5 mb-1.5">
                        <span class="size-1.5 rounded-full shrink-0" :class="act.color" />
                        <span class="font-medium">{{ act.label }}</span>
                      </div>
                      <p class="text-muted-foreground leading-relaxed mb-1.5">
                        {{ outline.threeActs[act.key as keyof typeof outline.threeActs]?.summary || '暂无' }}
                      </p>
                      <div v-if="outline.threeActs[act.key as keyof typeof outline.threeActs]?.keyEvents?.length">
                        <span class="text-foreground/60">关键事件：</span>
                        <ul class="mt-0.5 space-y-0.5">
                          <li
                            v-for="(e, i) in outline.threeActs[act.key as keyof typeof outline.threeActs].keyEvents"
                            :key="i"
                            class="text-muted-foreground flex gap-1"
                          >
                            <span class="text-foreground/30 shrink-0">•</span>
                            <span>{{ e }}</span>
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- 角色 -->
            <AccordionItem v-if="characters.length" value="characters" class="group">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group-data-[state=open]:bg-muted/30"
                >
                  <span>角色（{{ characters.length }}）</span>
                  <ChevronDown class="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent class="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div class="px-4 pb-3 space-y-2">
                  <div v-for="char in characters" :key="char.id" class="rounded-lg border bg-card p-3 space-y-1.5">
                    <div class="flex items-center gap-2">
                      <span class="text-sm font-medium">{{ char.name }}</span>
                      <Badge variant="outline" class="text-xs">{{ roleLabels[char.role] || char.role }}</Badge>
                    </div>
                    <div v-if="char.personality" class="text-xs text-muted-foreground">
                      <span class="text-foreground/70 font-medium">性格：</span>{{ char.personality }}
                    </div>
                    <div v-if="char.appearance" class="text-xs text-muted-foreground">
                      <span class="text-foreground/70 font-medium">外貌：</span>{{ char.appearance }}
                    </div>
                    <div v-if="char.background" class="text-xs text-muted-foreground">
                      <span class="text-foreground/70 font-medium">背景：</span>{{ char.background }}
                    </div>
                    <div v-if="char.motivation" class="text-xs text-muted-foreground">
                      <span class="text-foreground/70 font-medium">动机：</span>{{ char.motivation }}
                    </div>
                    <div v-if="char.arc" class="text-xs text-muted-foreground">
                      <span class="text-foreground/70 font-medium">人物弧光：</span>{{ char.arc }}
                    </div>
                    <div v-if="char.relationships.length" class="mt-1 pt-1.5 border-t border-border/50">
                      <span class="text-xs text-foreground/70 font-medium">关系：</span>
                      <div class="mt-0.5 flex flex-wrap gap-1">
                        <span v-for="rel in char.relationships" :key="rel.characterId"
                          class="inline-flex items-center text-xs text-muted-foreground bg-muted/50 rounded px-1.5 py-0.5">
                          {{ rel.characterName }} · {{ rel.relation }}
                        </span>
                      </div>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- 世界观 -->
            <AccordionItem v-if="worldBuilding" value="world" class="group">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group-data-[state=open]:bg-muted/30"
                >
                  世界观
                  <ChevronDown class="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent class="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div class="px-4 pb-3 space-y-2 text-xs">
                  <div v-if="worldBuilding.era" class="text-muted-foreground">
                    <span class="text-foreground/70 font-medium">时代：</span>{{ worldBuilding.era }}
                  </div>
                  <div v-if="worldBuilding.location" class="text-muted-foreground">
                    <span class="text-foreground/70 font-medium">地点：</span>{{ worldBuilding.location }}
                  </div>
                  <div v-if="worldBuilding.rules" class="text-muted-foreground">
                    <span class="text-foreground/70 font-medium">规则：</span>
                    <p class="mt-0.5 leading-relaxed whitespace-pre-wrap">{{ worldBuilding.rules }}</p>
                  </div>
                  <div v-if="worldBuilding.culture" class="text-muted-foreground">
                    <span class="text-foreground/70 font-medium">文化：</span>
                    <p class="mt-0.5 leading-relaxed whitespace-pre-wrap">{{ worldBuilding.culture }}</p>
                  </div>
                  <div v-if="worldBuilding.notes" class="text-muted-foreground">
                    <span class="text-foreground/70 font-medium">备注：</span>
                    <p class="mt-0.5 leading-relaxed whitespace-pre-wrap">{{ worldBuilding.notes }}</p>
                  </div>
                  <div v-if="worldBuilding.factions.length" class="space-y-1.5">
                    <span class="text-foreground/70 font-medium">势力：</span>
                    <div v-for="f in worldBuilding.factions" :key="f.name" class="rounded-md bg-muted/40 p-2">
                      <div class="flex items-center gap-1.5">
                        <span class="font-medium">{{ f.name }}</span>
                        <span v-if="f.goals" class="text-muted-foreground">— {{ f.goals }}</span>
                      </div>
                      <p v-if="f.description" class="mt-0.5 text-muted-foreground leading-relaxed">{{ f.description }}</p>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- 章节规划 -->
            <AccordionItem v-if="outline?.chapterPlan?.length" value="chapters" class="group">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-between px-4 py-3 text-sm font-medium hover:bg-muted/50 transition-colors cursor-pointer group-data-[state=open]:bg-muted/30"
                >
                  <span>章节规划（{{ outline.chapterPlan.length }}）</span>
                  <ChevronDown class="size-4 text-muted-foreground shrink-0 transition-transform duration-200 group-data-[state=open]:rotate-180" />
                </AccordionTrigger>
              </AccordionHeader>
              <AccordionContent class="overflow-hidden data-[state=open]:animate-accordion-down data-[state=closed]:animate-accordion-up">
                <div class="px-4 pb-3">
                  <div class="rounded-lg border overflow-hidden">
                    <div class="overflow-x-auto">
                      <table class="w-full text-xs">
                        <thead>
                          <tr class="bg-muted/50 border-b">
                            <th class="text-left px-3 py-2 font-medium text-muted-foreground w-10">#</th>
                            <th class="text-left px-3 py-2 font-medium text-muted-foreground">标题</th>
                            <th class="text-left px-3 py-2 font-medium text-muted-foreground w-16">状态</th>
                            <th class="text-right px-3 py-2 font-medium text-muted-foreground w-16">字数</th>
                          </tr>
                        </thead>
                        <tbody>
                          <tr
                            v-for="cp in outline.chapterPlan"
                            :key="cp.index"
                            class="border-b border-border/30 last:border-0 hover:bg-muted/30 transition-colors"
                          >
                            <td class="px-3 py-2 tabular-nums text-muted-foreground">{{ cp.index + 1 }}</td>
                            <td class="px-3 py-2">
                              <div class="font-medium truncate max-w-[180px]">{{ cp.title || '未命名' }}</div>
                              <div v-if="cp.summary" class="text-muted-foreground mt-0.5 line-clamp-2">{{ cp.summary }}</div>
                            </td>
                            <td class="px-3 py-2">
                              <Badge :class="badgeClass(cp.status)" variant="outline" class="text-[10px]">
                                {{ chapterStatusLabels[cp.status] || cp.status }}
                              </Badge>
                            </td>
                            <td class="px-3 py-2 text-right tabular-nums text-muted-foreground">
                              {{ cp.estimatedWordCount.toLocaleString() }}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                    </div>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>

            <!-- Empty fallback -->
            <AccordionItem v-if="!outline && !characters.length && !worldBuilding" value="empty" class="group pointer-events-none">
              <AccordionHeader class="flex">
                <AccordionTrigger
                  class="flex flex-1 items-center justify-center px-4 py-8 text-sm text-muted-foreground cursor-default"
                  disabled
                >
                  暂无其他数据
                </AccordionTrigger>
              </AccordionHeader>
            </AccordionItem>
          </AccordionRoot>
        </div>
      </template>

      <template v-else>
        <SheetHeader class="shrink-0">
          <SheetTitle>小说数据</SheetTitle>
        </SheetHeader>
        <div class="flex-1 flex items-center justify-center text-muted-foreground text-sm">
          小说数据不存在
        </div>
      </template>
    </SheetContent>
  </Sheet>
</template>
