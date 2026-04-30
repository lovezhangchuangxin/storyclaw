<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { Sparkles } from 'lucide-vue-next'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'

const router = useRouter()
const idea = ref('')
const selectedGenre = ref('')

const genres = [
  { emoji: '🏙️', label: '都市' },
  { emoji: '🔮', label: '奇幻' },
  { emoji: '🚀', label: '科幻' },
  { emoji: '🕵️', label: '悬疑' },
  { emoji: '❤️', label: '爱情' },
  { emoji: '👻', label: '恐怖' },
  { emoji: '⚔️', label: '武侠' },
  { emoji: '📜', label: '历史' },
]

function startStory() {
  if (!idea.value.trim()) return
  router.push('/story/new')
}

function selectGenre(genre: string) {
  selectedGenre.value = genre
  idea.value = `写一个${genre}题材的故事`
}
</script>

<template>
  <div class="p-4">
    <h1 class="text-xl font-bold mb-4">创作新故事</h1>

    <div class="mb-6">
      <label class="block text-sm font-medium mb-2">你想写一个什么样的故事？</label>
      <Textarea
        v-model="idea"
        placeholder="用自然语言描述你的想法…

比如：
  · 一个关于时间循环的科幻爱情故事
  · 一个都市悬疑，主角能听见物品的记忆
  · 当代武侠，一个外卖员意外获得古老剑谱"
        :rows="6"
        class="resize-none"
      />
      <Button class="mt-3 w-full" :disabled="!idea.trim()" @click="startStory">
        <Sparkles class="size-4 mr-1.5" />
        开始创作
      </Button>
    </div>

    <div>
      <p class="text-sm text-muted-foreground mb-3">或者选择一个类型快速开始：</p>
      <div class="grid grid-cols-4 gap-2">
        <button
          v-for="g in genres"
          :key="g.label"
          class="flex flex-col items-center gap-1 rounded-lg border px-3 py-3 text-sm transition-colors"
          :class="
            selectedGenre === g.label ? 'border-primary bg-primary/5' : 'hover:border-primary/50'
          "
          @click="selectGenre(g.label)"
        >
          <span class="text-xl">{{ g.emoji }}</span>
          <span class="text-xs text-muted-foreground">{{ g.label }}</span>
        </button>
      </div>
    </div>
  </div>
</template>
