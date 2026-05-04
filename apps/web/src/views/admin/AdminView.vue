<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { adminListUsers, adminListNovels, adminGetStats } from '@/lib/api-client'
import type { AdminStats, AdminUserSummary, AdminNovelSummary } from '@/db/types'
import { toast } from 'vue-sonner'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import {
  Users,
  BookOpen,
  Activity,
  TrendingUp,
  Search,
  ChevronLeft,
  ChevronRight,
  Shield,
} from 'lucide-vue-next'

const route = useRoute()
const router = useRouter()

const stats = ref<AdminStats | null>(null)
const statsLoading = ref(true)

// Overview - independent data (always page 1)
const recentUsers = ref<AdminUserSummary[]>([])
const recentNovels = ref<AdminNovelSummary[]>([])

// Users tab - paginated
const users = ref<AdminUserSummary[]>([])
const usersTotal = ref(0)
const usersPage = ref(1)
const usersLoading = ref(false)
const userSearch = ref('')

// Novels tab - paginated
const novels = ref<AdminNovelSummary[]>([])
const novelsTotal = ref(0)
const novelsPage = ref(1)
const novelsLoading = ref(false)
const novelSearch = ref('')

const perPage = 20

const tabFromQuery = computed(() => {
  const t = route.query.tab as string
  if (t === 'users' || t === 'novels') return t
  return 'overview'
})

const totalPages = (total: number) => Math.max(1, Math.ceil(total / perPage))

const filteredUsers = computed(() => {
  if (!userSearch.value.trim()) return users.value
  const q = userSearch.value.toLowerCase()
  return users.value.filter((u) => u.email.toLowerCase().includes(q))
})

const filteredNovels = computed(() => {
  if (!novelSearch.value.trim()) return novels.value
  const q = novelSearch.value.toLowerCase()
  return novels.value.filter(
    (n) => n.title.toLowerCase().includes(q) || n.authorEmail.toLowerCase().includes(q),
  )
})

function onTabChange(val: string | number) {
  router.replace({ query: val === 'overview' ? {} : { tab: val } })
}

async function loadStats() {
  try {
    stats.value = await adminGetStats()
  } catch (e) {
    console.error('Failed to load stats:', e)
  } finally {
    statsLoading.value = false
  }
}

async function loadOverviewUsers() {
  try {
    const resp = await adminListUsers(1, 5)
    recentUsers.value = resp.data
    usersTotal.value = resp.total
  } catch (e) {
    console.error('Failed to load overview users:', e)
  }
}

async function loadOverviewNovels() {
  try {
    const resp = await adminListNovels(1, 5)
    recentNovels.value = resp.data
    novelsTotal.value = resp.total
  } catch (e) {
    console.error('Failed to load overview novels:', e)
  }
}

async function loadUsers(p = 1) {
  usersLoading.value = true
  try {
    const resp = await adminListUsers(p, perPage)
    users.value = resp.data
    usersTotal.value = resp.total
    usersPage.value = resp.page
  } catch {
    toast.error('加载用户列表失败')
  } finally {
    usersLoading.value = false
  }
}

async function loadNovels(p = 1) {
  novelsLoading.value = true
  try {
    const resp = await adminListNovels(p, perPage)
    novels.value = resp.data
    novelsTotal.value = resp.total
    novelsPage.value = resp.page
  } catch {
    toast.error('加载小说列表失败')
  } finally {
    novelsLoading.value = false
  }
}

watch(
  () => route.query.tab,
  (tab) => {
    if (tab === 'users' && users.value.length === 0) loadUsers()
    if (tab === 'novels' && novels.value.length === 0) loadNovels()
  },
)

onMounted(() => {
  loadStats()
  loadOverviewUsers()
  loadOverviewNovels()
  loadUsers()
  loadNovels()
})
</script>

<template>
  <div class="max-w-5xl mx-auto p-4 md:p-6 space-y-5">
    <div class="flex items-center gap-2">
      <Shield class="size-5 text-muted-foreground" />
      <h2 class="text-lg font-semibold">管理后台</h2>
    </div>

    <Tabs :default-value="tabFromQuery" @update:model-value="onTabChange">
      <TabsList>
        <TabsTrigger value="overview">概览</TabsTrigger>
        <TabsTrigger value="users">用户</TabsTrigger>
        <TabsTrigger value="novels">小说</TabsTrigger>
      </TabsList>

      <!-- Overview Tab -->
      <TabsContent value="overview" class="space-y-5 pt-3">
        <!-- Stats Cards -->
        <div v-if="statsLoading" class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <div v-for="i in 4" :key="i" class="h-24 rounded-xl bg-muted animate-pulse" />
        </div>
        <div v-else class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader class="flex flex-row items-center justify-between pb-2">
              <CardTitle class="text-sm font-medium">总用户</CardTitle>
              <Users class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{{ usersTotal.toLocaleString() }}</div>
              <p class="text-xs text-muted-foreground mt-1">注册用户</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader class="flex flex-row items-center justify-between pb-2">
              <CardTitle class="text-sm font-medium">总小说</CardTitle>
              <BookOpen class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">{{ novelsTotal.toLocaleString() }}</div>
              <p class="text-xs text-muted-foreground mt-1">创作小说</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader class="flex flex-row items-center justify-between pb-2">
              <CardTitle class="text-sm font-medium">LLM 调用</CardTitle>
              <Activity class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">
                {{ stats ? (stats.totalLlmCalls ?? 0).toLocaleString() : '--' }}
              </div>
              <p class="text-xs text-muted-foreground mt-1">模型调用</p>
            </CardContent>
          </Card>
          <Card>
            <CardHeader class="flex flex-row items-center justify-between pb-2">
              <CardTitle class="text-sm font-medium">人均小说</CardTitle>
              <TrendingUp class="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div class="text-2xl font-bold">
                {{ usersTotal > 0 ? (novelsTotal / usersTotal).toFixed(1) : '0' }}
              </div>
              <p class="text-xs text-muted-foreground mt-1">每用户平均</p>
            </CardContent>
          </Card>
        </div>

        <!-- Recent Users -->
        <div class="rounded-xl border bg-card shadow-sm">
          <div class="p-4 border-b flex items-center justify-between">
            <h3 class="text-sm font-medium">最近注册用户</h3>
            <button
              class="text-xs text-primary hover:underline underline-offset-2"
              @click="onTabChange('users')"
            >
              查看全部
            </button>
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
                <tr
                  v-for="user in recentUsers"
                  :key="user.id"
                  class="border-b hover:bg-muted/30 transition-colors"
                >
                  <td class="p-3">{{ user.email }}</td>
                  <td class="p-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      :class="
                        user.role === 'admin'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ user.role === 'admin' ? '管理员' : '用户' }}
                    </span>
                  </td>
                  <td class="p-3 text-right">{{ user.novelCount }}</td>
                  <td class="p-3 text-right text-muted-foreground">
                    {{ user.createdAt?.split('T')[0] }}
                  </td>
                </tr>
                <tr v-if="recentUsers.length === 0 && !usersLoading">
                  <td colspan="4" class="p-8 text-center text-sm text-muted-foreground">
                    暂无用户
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Recent Novels -->
        <div class="rounded-xl border bg-card shadow-sm">
          <div class="p-4 border-b flex items-center justify-between">
            <h3 class="text-sm font-medium">最近更新小说</h3>
            <button
              class="text-xs text-primary hover:underline underline-offset-2"
              @click="onTabChange('novels')"
            >
              查看全部
            </button>
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
                <tr
                  v-for="novel in recentNovels"
                  :key="novel.id"
                  class="border-b hover:bg-muted/30 transition-colors"
                >
                  <td class="p-3 font-medium">{{ novel.title || '未命名' }}</td>
                  <td class="p-3 text-muted-foreground">{{ novel.authorEmail }}</td>
                  <td class="p-3 text-right">{{ novel.wordCount?.toLocaleString() }}</td>
                  <td class="p-3 text-center">
                    <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {{ novel.status }}
                    </span>
                  </td>
                  <td class="p-3 text-right text-muted-foreground">
                    {{ novel.updatedAt?.split('T')[0] }}
                  </td>
                </tr>
                <tr v-if="recentNovels.length === 0 && !novelsLoading">
                  <td colspan="5" class="p-8 text-center text-sm text-muted-foreground">
                    暂无小说
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </TabsContent>

      <!-- Users Tab -->
      <TabsContent value="users" class="space-y-4 pt-3">
        <!-- Search -->
        <div class="flex items-center gap-3">
          <div class="relative flex-1">
            <Search
              class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            />
            <Input v-model="userSearch" placeholder="搜索用户邮箱..." class="pl-8" />
          </div>
          <span class="text-sm text-muted-foreground shrink-0">共 {{ usersTotal }} 人</span>
        </div>

        <!-- Loading -->
        <div v-if="usersLoading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="h-12 rounded-lg bg-muted animate-pulse" />
        </div>

        <!-- Table -->
        <div v-else class="rounded-xl border bg-card shadow-sm">
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
                <tr
                  v-for="user in filteredUsers"
                  :key="user.id"
                  class="border-b hover:bg-muted/30 transition-colors"
                >
                  <td class="p-3">{{ user.email }}</td>
                  <td class="p-3">
                    <span
                      class="text-xs px-2 py-0.5 rounded-full"
                      :class="
                        user.role === 'admin'
                          ? 'bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400'
                          : 'bg-muted text-muted-foreground'
                      "
                    >
                      {{ user.role === 'admin' ? '管理员' : '用户' }}
                    </span>
                  </td>
                  <td class="p-3 text-right">{{ user.novelCount }}</td>
                  <td class="p-3 text-right text-muted-foreground">
                    {{ user.createdAt?.split('T')[0] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty -->
          <div
            v-if="filteredUsers.length === 0 && userSearch"
            class="p-12 flex flex-col items-center justify-center text-center"
          >
            <Search class="size-8 mb-3 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">没有找到匹配的用户</p>
          </div>
          <div
            v-if="users.length === 0 && !userSearch"
            class="p-12 flex flex-col items-center justify-center text-center"
          >
            <Users class="size-8 mb-3 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">暂无注册用户</p>
          </div>

          <!-- Pagination -->
          <div v-if="usersTotal > perPage" class="flex items-center justify-between p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              :disabled="usersPage <= 1"
              @click="loadUsers(usersPage - 1)"
            >
              <ChevronLeft class="size-4" />
              上一页
            </Button>
            <span class="text-sm text-muted-foreground">
              {{ usersPage }} / {{ totalPages(usersTotal) }}
            </span>
            <Button
              variant="outline"
              size="sm"
              :disabled="usersPage >= totalPages(usersTotal)"
              @click="loadUsers(usersPage + 1)"
            >
              下一页
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>
      </TabsContent>

      <!-- Novels Tab -->
      <TabsContent value="novels" class="space-y-4 pt-3">
        <!-- Search -->
        <div class="flex items-center gap-3">
          <div class="relative flex-1">
            <Search
              class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
            />
            <Input v-model="novelSearch" placeholder="搜索小说标题或作者..." class="pl-8" />
          </div>
          <span class="text-sm text-muted-foreground shrink-0">共 {{ novelsTotal }} 本</span>
        </div>

        <!-- Loading -->
        <div v-if="novelsLoading" class="space-y-3">
          <div v-for="i in 5" :key="i" class="h-12 rounded-lg bg-muted animate-pulse" />
        </div>

        <!-- Table -->
        <div v-else class="rounded-xl border bg-card shadow-sm">
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
                <tr
                  v-for="novel in filteredNovels"
                  :key="novel.id"
                  class="border-b hover:bg-muted/30 transition-colors"
                >
                  <td class="p-3 font-medium">{{ novel.title || '未命名' }}</td>
                  <td class="p-3 text-muted-foreground">{{ novel.authorEmail }}</td>
                  <td class="p-3 text-right">{{ novel.wordCount?.toLocaleString() }}</td>
                  <td class="p-3 text-center">
                    <span class="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                      {{ novel.status }}
                    </span>
                  </td>
                  <td class="p-3 text-right text-muted-foreground">
                    {{ novel.updatedAt?.split('T')[0] }}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>

          <!-- Empty -->
          <div
            v-if="filteredNovels.length === 0 && novelSearch"
            class="p-12 flex flex-col items-center justify-center text-center"
          >
            <Search class="size-8 mb-3 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">没有找到匹配的小说</p>
          </div>
          <div
            v-if="novels.length === 0 && !novelSearch"
            class="p-12 flex flex-col items-center justify-center text-center"
          >
            <BookOpen class="size-8 mb-3 text-muted-foreground/30" />
            <p class="text-sm text-muted-foreground">暂无小说</p>
          </div>

          <!-- Pagination -->
          <div v-if="novelsTotal > perPage" class="flex items-center justify-between p-3 border-t">
            <Button
              variant="outline"
              size="sm"
              :disabled="novelsPage <= 1"
              @click="loadNovels(novelsPage - 1)"
            >
              <ChevronLeft class="size-4" />
              上一页
            </Button>
            <span class="text-sm text-muted-foreground">
              {{ novelsPage }} / {{ totalPages(novelsTotal) }}
            </span>
            <Button
              variant="outline"
              size="sm"
              :disabled="novelsPage >= totalPages(novelsTotal)"
              @click="loadNovels(novelsPage + 1)"
            >
              下一页
              <ChevronRight class="size-4" />
            </Button>
          </div>
        </div>
      </TabsContent>
    </Tabs>
  </div>
</template>
