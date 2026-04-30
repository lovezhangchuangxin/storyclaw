<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { BookOpen } from 'lucide-vue-next'
import ReaderView from '@/components/reader/ReaderView.vue'
import { getChaptersByNovelId } from '@/db/chapters'
import type { Chapter } from '@/db/types'
import type { ReaderSettings } from '@/components/reader/types'

const props = defineProps<{
  novelId: string
}>()

const chapters = ref<Chapter[]>([])
const chapterIndex = ref(0)
const loaded = ref(false)

const settings = ref<ReaderSettings>({
  fontFamily: '"Noto Sans SC", Inter, system-ui, sans-serif',
  fontSize: 18,
  lineHeight: 1.8,
  paragraphSpacing: 1,
  textColor: '#333333',
  backgroundColor: '#F5F0E8',
  scrollMode: 'scroll',
  autoScrollSpeed: 50,
})

const currentChapter = computed(() => chapters.value[chapterIndex.value])

watch(() => props.novelId, async (id) => {
  if (!id) return
  chapters.value = await getChaptersByNovelId(id)
  chapters.value.sort((a, b) => a.index - b.index)
  loaded.value = true
}, { immediate: true })

function prevChapter() {
  if (chapterIndex.value > 0) chapterIndex.value--
}

function nextChapter() {
  if (chapterIndex.value < chapters.value.length - 1) chapterIndex.value++
}
</script>

<template>
  <div class="flex-1 flex flex-col min-h-0">
    <!-- Loading -->
    <div v-if="!loaded" class="flex-1 flex items-center justify-center">
      <div class="text-sm text-muted-foreground animate-pulse">加载中...</div>
    </div>

    <!-- Empty -->
    <div v-else-if="chapters.length === 0" class="flex-1 flex flex-col items-center justify-center text-muted-foreground px-4">
      <BookOpen class="size-12 mb-4 text-muted-foreground/30" />
      <p class="text-sm font-medium mb-1">还没有章节</p>
      <p class="text-xs text-center max-w-[200px]">切换到创作模式，让 AI 为你生成故事内容</p>
    </div>

    <!-- Reader -->
    <ReaderView
      v-else
      :content="currentChapter.content"
      :title="currentChapter.title"
      :chapter-index="chapterIndex"
      :total-chapters="chapters.length"
      :settings="settings"
      @prev-chapter="prevChapter"
      @next-chapter="nextChapter"
      @show-controls="() => {}"
      @update-progress="() => {}"
    />
  </div>
</template>
