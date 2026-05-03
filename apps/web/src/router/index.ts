import type { RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'

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
    ],
  },
]
