<script setup lang="ts">
import { shallowRef, watch } from 'vue'
import JsonNode from './JsonNode.vue'

const props = withDefaults(
  defineProps<{
    data: unknown
    rootKey?: string
    maxDepth?: number
    collapsedNodeLength?: number
    showCopy?: boolean
    maxStringLength?: number
    maxRenderDepth?: number
  }>(),
  {
    rootKey: 'root',
    maxDepth: 2,
    collapsedNodeLength: 10,
    showCopy: true,
    maxStringLength: 100,
    maxRenderDepth: 20,
  },
)

// shallowRef avoids deep Proxy wrapping of WeakSet
const visited = shallowRef(new WeakSet<object>())

watch(() => props.data, () => {
  visited.value = new WeakSet<object>()
})
</script>

<template>
  <div class="jt-viewer">
    <JsonNode
      :key-name="null"
      :value="props.data"
      :depth="0"
      :path="rootKey"
      :max-depth="maxDepth"
      :max-render-depth="maxRenderDepth"
      :collapsed-node-length="collapsedNodeLength"
      :max-string-length="maxStringLength"
      :show-copy="showCopy"
      :visited="visited"
    />
  </div>
</template>

<style scoped>
.jt-viewer {
  font-family: ui-monospace, SFMono-Regular, 'SF Mono', Menlo, Consolas, 'Liberation Mono', monospace;
  font-size: 12px;
  line-height: 1.6;
  color: var(--jt-key);
  user-select: none;
  overflow-x: auto;
}
@media (min-width: 768px) {
  .jt-viewer {
    font-size: 13px;
  }
}

.jt-viewer::-webkit-scrollbar {
  height: 4px;
}
.jt-viewer::-webkit-scrollbar-track {
  background: transparent;
}
.jt-viewer::-webkit-scrollbar-thumb {
  background: var(--jt-guide);
  border-radius: 2px;
}
.jt-viewer::-webkit-scrollbar-thumb:hover {
  background: var(--jt-bracket);
}
</style>
