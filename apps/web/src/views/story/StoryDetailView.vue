<script setup lang="ts">
import { useRoute } from 'vue-router'

const route = useRoute()
const storyId = route.params.id as string
</script>

<template>
  <div class="p-4">
    <h1 class="text-2xl font-bold">故事详情 #{{ storyId }}</h1>
    <p class="text-muted-foreground">阅读和创作将在这里</p>
  </div>
</template>
