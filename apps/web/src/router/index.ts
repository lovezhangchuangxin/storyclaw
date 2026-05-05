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
        meta: { title: 'sidebar.bookshelf' },
      },
      {
        path: 'my',
        name: 'my',
        component: () => import('@/views/my/MyView.vue'),
        meta: { title: 'sidebar.my' },
      },
      {
        path: 'prompts',
        name: 'prompts',
        component: () => import('@/views/prompts/PromptsView.vue'),
        meta: { title: 'sidebar.prompts' },
      },
      {
        path: 'story/:id',
        name: 'story',
        component: () => import('@/views/story/StoryDetailView.vue'),
        meta: { title: 'story.reader', back: true, internalScroll: true },
      },
      {
        path: 'settings/model',
        name: 'model-config',
        component: () => import('@/views/settings/ModelConfigView.vue'),
        meta: { title: 'sidebar.modelConfig', back: true },
      },
      {
        path: 'settings/server',
        name: 'server-config',
        component: () => import('@/views/settings/ServerView.vue'),
        meta: { title: 'sidebar.serverConnection', back: true },
      },
      {
        path: 'settings/appearance',
        name: 'appearance',
        component: () => import('@/views/settings/AppearanceView.vue'),
        meta: { title: 'sidebar.appearance', back: true },
      },
      {
        path: 'admin',
        name: 'admin',
        component: () => import('@/views/admin/AdminView.vue'),
        meta: { title: 'sidebar.admin', requiresAuth: true, requiresAdmin: true },
      },
    ],
  },
]

export const router = createRouter({
  history: createWebHistory(import.meta.env.BASE_URL),
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
