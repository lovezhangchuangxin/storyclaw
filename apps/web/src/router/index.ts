import type { RouteRecordRaw } from 'vue-router'
import AppLayout from '@/components/layout/AppLayout.vue'
import HomeView from '@/views/home/HomeView.vue'
import CreateView from '@/views/create/CreateView.vue'
import MyView from '@/views/my/MyView.vue'
import StoryDetailView from '@/views/story/StoryDetailView.vue'
import ModelConfigView from '@/views/settings/ModelConfigView.vue'
import ServerView from '@/views/settings/ServerView.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: AppLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
        meta: { title: '书架' },
      },
      {
        path: 'create',
        name: 'create',
        component: CreateView,
        meta: { title: '创作新故事' },
      },
      {
        path: 'my',
        name: 'my',
        component: MyView,
        meta: { title: '我的' },
      },
      {
        path: 'story/:id',
        name: 'story',
        component: StoryDetailView,
        meta: { title: '阅读', back: true },
      },
      {
        path: 'settings/model',
        name: 'model-config',
        component: ModelConfigView,
        meta: { title: '模型配置', back: true },
      },
      {
        path: 'settings/server',
        name: 'server-config',
        component: ServerView,
        meta: { title: '后端连接', back: true },
      },
    ],
  },
]
