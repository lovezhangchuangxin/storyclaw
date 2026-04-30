import type { RouteRecordRaw } from 'vue-router'
import HomeView from '@/views/home/HomeView.vue'
import CreateView from '@/views/create/CreateView.vue'
import MyView from '@/views/my/MyView.vue'
import StoryDetailView from '@/views/story/StoryDetailView.vue'
import ModelConfigView from '@/views/settings/ModelConfigView.vue'

export const routes: RouteRecordRaw[] = [
  {
    path: '/',
    name: 'home',
    component: HomeView,
  },
  {
    path: '/create',
    name: 'create',
    component: CreateView,
  },
  {
    path: '/my',
    name: 'my',
    component: MyView,
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
]
