<script setup lang="ts">
import { BookOpen } from 'lucide-vue-next'
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">

    <!-- App Info Card -->
    <section class="rounded-xl border bg-card shadow-sm p-5">
      <div class="flex items-center gap-4">
        <div class="size-11 rounded-xl bg-primary/[0.06] flex items-center justify-center shrink-0">
          <BookOpen class="size-5 text-primary/40" />
        </div>
        <div>
          <p class="text-sm font-semibold">StoryClaw</p>
          <p class="text-xs text-muted-foreground">本地模式 · 数据存储在浏览器中</p>
        </div>
      </div>
    </section>

  </div>
</template>
