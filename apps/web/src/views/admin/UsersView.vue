<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { adminListUsers, adminGetStats } from '@/lib/api-client'
import type { AdminUserSummary, AdminStats, PaginatedResponse } from '@/db/types'
import { toast } from 'vue-sonner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Users, BookOpen, BarChart3 } from 'lucide-vue-next'

const users = ref<AdminUserSummary[]>([])
const usersTotal = ref(0)
const usersPage = ref(1)
const perPage = 20

const stats = ref<AdminStats>({ totalUsers: 0, totalNovels: 0, totalLlmCalls: 0 })

async function loadUsers(page = 1) {
  try {
    const resp = await adminListUsers(page, perPage)
    users.value = resp.data
    usersTotal.value = resp.total
    usersPage.value = resp.page
  } catch (e) {
    toast.error('加载用户列表失败')
  }
}

async function loadStats() {
  try {
    stats.value = await adminGetStats()
  } catch {
    // stats stay at defaults
  }
}

onMounted(() => {
  loadUsers()
  loadStats()
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 md:p-6 space-y-6">
    <h2 class="text-lg font-semibold">管理后台</h2>

    <div class="grid grid-cols-1 sm:grid-cols-3 gap-4">
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">用户总数</CardTitle>
          <Users class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalUsers }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">小说总数</CardTitle>
          <BookOpen class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalNovels }}</div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader class="flex flex-row items-center justify-between pb-2">
          <CardTitle class="text-sm font-medium">LLM 调用</CardTitle>
          <BarChart3 class="size-4 text-muted-foreground" />
        </CardHeader>
        <CardContent>
          <div class="text-2xl font-bold">{{ stats.totalLlmCalls }}</div>
        </CardContent>
      </Card>
    </div>

    <div class="rounded-xl border bg-card shadow-sm">
      <div class="p-4 border-b">
        <h3 class="text-sm font-medium">用户列表 ({{ usersTotal }})</h3>
      </div>
      <div class="overflow-x-auto">
        <table class="w-full text-sm">
          <thead>
            <tr class="border-b bg-muted/50">
              <th class="text-left p-3 font-medium">邮箱</th>
              <th class="text-left p-3 font-medium">角色</th>
              <th class="text-right p-3 font-medium">小说数</th>
              <th class="text-right p-3 font-medium">注册时间</th>
            </tr>
          </thead>
          <tbody>
            <tr v-for="user in users" :key="user.id" class="border-b hover:bg-muted/30">
              <td class="p-3">{{ user.email }}</td>
              <td class="p-3">
                <span
                  class="text-xs px-2 py-0.5 rounded-full"
                  :class="user.role === 'admin'
                    ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                    : 'bg-muted text-muted-foreground'"
                >
                  {{ user.role === 'admin' ? '管理员' : '用户' }}
                </span>
              </td>
              <td class="p-3 text-right">{{ user.novelCount }}</td>
              <td class="p-3 text-right text-muted-foreground">{{ user.createdAt?.split('T')[0] }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  </div>
</template>
