import type { RouteRecordRaw } from 'vue-router'
import { createRouter, createWebHistory } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import { useAuthStore } from '@/stores/auth'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: () => import('@/views/home/HomeView.vue'),
        meta: { title: '书架' },
      },
      {
        path: 'my',
        name: 'my',
        component: () => import('@/views/my/MyView.vue'),
        meta: { title: '我的' },
      },
      {
        path: 'prompts',
        name: 'prompts',
        component: () => import('@/views/prompts/PromptsView.vue'),
        meta: { title: '提示词' },
      },
      {
        path: 'story/:id',
        name: 'story',
        component: () => import('@/views/story/StoryDetailView.vue'),
        meta: { title: '阅读', back: true },
      },
      {
        path: 'settings/model',
        name: 'model-config',
        component: () => import('@/views/settings/ModelConfigView.vue'),
        meta: { title: '模型配置', back: true },
      },
      {
        path: 'settings/server',
        name: 'server-config',
        component: () => import('@/views/settings/ServerView.vue'),
        meta: { title: '后端连接', back: true },
      },
      {
        path: 'settings/appearance',
        name: 'appearance',
        component: () => import('@/views/settings/AppearanceView.vue'),
        meta: { title: '外观', back: true },
      },
      {
        path: 'admin/users',
        name: 'admin-users',
        component: () => import('@/views/admin/UsersView.vue'),
        meta: { title: '用户管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'admin/novels',
        name: 'admin-novels',
        component: () => import('@/views/admin/NovelsView.vue'),
        meta: { title: '小说管理', requiresAuth: true, requiresAdmin: true },
      },
      {
        path: 'admin/stats',
        name: 'admin-stats',
        component: () => import('@/views/admin/StatsView.vue'),
        meta: { title: '数据统计', requiresAuth: true, requiresAdmin: true },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(),
  routes,
})

router.beforeEach((to, _from, next) => {
  const auth = useAuthStore()

  if (to.meta.requiresAuth && !auth.isAuthenticated) {
    next({ name: 'server-config' })
    return
  }

  if (to.meta.requiresAdmin && !auth.isAdmin) {
    next({ name: 'home' })
    return
  }

  next()
})

export default router
