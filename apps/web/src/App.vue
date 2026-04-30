<script setup lang="ts">
import { Toaster } from '@/components/ui/sonner'
</script>

<template>
  <router-view />
  <Toaster position="top-center" :duration="3000" richColors class="z-[9999]" />
</template>
