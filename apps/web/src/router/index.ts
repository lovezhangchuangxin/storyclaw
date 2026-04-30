import type { RouteRecordRaw } from 'vue-router'
import MainLayout from '@/views/MainLayout.vue'
import HomeView from '@/views/home/HomeView.vue'
import CreateView from '@/views/create/CreateView.vue'
import MyView from '@/views/my/MyView.vue'
import StoryDetailView from '@/views/story/StoryDetailView.vue'
import ModelConfigView from '@/views/settings/ModelConfigView.vue'
import ServerView from '@/views/settings/ServerView.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    component: MainLayout,
    children: [
      {
        path: '',
        name: 'home',
        component: HomeView,
      },
      {
        path: 'create',
        name: 'create',
        component: CreateView,
      },
      {
        path: 'my',
        name: 'my',
        component: MyView,
      },
    ],
  },
  {
    path: '/story/:id',
    name: 'story',
    component: StoryDetailView,
  },
  {
    path: '/settings/model',
    name: 'model-config',
    component: ModelConfigView,
  },
  {
    path: '/settings/server',
    name: 'server-config',
    component: ServerView,
  },
]
