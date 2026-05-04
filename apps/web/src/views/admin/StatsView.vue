<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminGetStats } from '@/lib/api-client'
import type { AdminStats } from '@/db/types'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, BookOpen, Activity, TrendingUp } from 'lucide-vue-next'

const stats = ref<AdminStats>({ totalUsers: 0, totalNovels: 0, totalLlmCalls: 0 })
const loading = ref(true)

onMounted(async () => {
  try {
    stats.value = await adminGetStats()
  } catch {
    // stay at defaults
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
    <h2 class="text-lg font-semibold">数据统计</h2>

    <div v-if="loading" class="text-sm text-muted-foreground">加载中...</div>

    <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">总用户数</CardTitle>
          <Users class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-bold">{{ stats.totalUsers.toLocaleString() }}</div>
          <p class="text-xs text-muted-foreground mt-1">注册用户总数</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">总小说数</CardTitle>
          <BookOpen class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-bold">{{ stats.totalNovels.toLocaleString() }}</div>
          <p class="text-xs text-muted-foreground mt-1">创作小说总数</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">LLM 调用</CardTitle>
          <Activity class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-bold">{{ stats.totalLlmCalls.toLocaleString() }}</div>
          <p class="text-xs text-muted-foreground mt-1">模型调用总次数</p>
        </CardContent>
      </Card>

      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">人均小说</CardTitle>
          <TrendingUp class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-3xl font-bold">
            {{ stats.totalUsers > 0 ? (stats.totalNovels / stats.totalUsers).toFixed(1) : '0' }}
          </div>
          <p class="text-xs text-muted-foreground mt-1">每用户平均创作数</p>
        </CardContent>
      </Card>
    </div>
  </div>
</template>
