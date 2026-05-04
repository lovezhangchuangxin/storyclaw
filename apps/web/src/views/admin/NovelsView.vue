<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminListNovels } from '@/lib/api-client'
import type { AdminNovelSummary } from '@/db/types'
import { toast } from 'vue-sonner'

const novels = ref<AdminNovelSummary[]>([])
const total = ref(0)
const page = ref(1)
const perPage = 20

async function loadNovels(p = 1) {
  try {
    const resp = await adminListNovels(p, perPage)
    novels.value = resp.data
    total.value = resp.total
    page.value = resp.page
  } catch {
    toast.error('加载小说列表失败')
  }
}

onMounted(() => loadNovels())
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
    <h2 class="text-lg font-semibold">小说管理</h2>

    <div class="rounded-xl border bg-card shadow-sm">
      <div class="p-4 border-b">
        <h3 class="text-sm font-medium">全部小说 ({{ total }})</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/50">
              <th class="text-left p-3 font-medium">标题</th>
              <th class="text-left p-3 font-medium">作者</th>
              <th class="text-right p-3 font-medium">字数</th>
              <th class="text-center p-3 font-medium">状态</th>
              <th class="text-right p-3 font-medium">更新时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="novel in novels" :key="novel.id" class="border-b hover:bg-muted/30">
              <td class="p-3 font-medium">{{ novel.title || '未命名' }}</td>
              <td class="p-3 text-muted-foreground">{{ novel.authorEmail }}</td>
              <td class="p-3 text-right">{{ novel.wordCount?.toLocaleString() }}</td>
              <td class="p-3 text-center">
                <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  {{ novel.status }}
                </span>
              </td>
              <td class="p-3 text-right text-muted-foreground">{{ novel.updatedAt?.split('T')[0] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
