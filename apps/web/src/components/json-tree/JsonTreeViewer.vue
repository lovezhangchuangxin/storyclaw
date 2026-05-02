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

// shallowRef avoids deep Proxy wrapping of WeakSet — mutations to the
// WeakSet must NOT trigger Vue reactivity, otherwise the collection-proxy
// trigger causes a re-render which re-evaluates isCircular and falsely
// reports the root node as a circular reference.
const visited = shallowRef(new WeakSet<object>())

// Reset the visited set when input data changes to avoid stale state
// leaking across different render cycles.
watch(() => props.data, () => {
  visited.value = new WeakSet<object>()
})
</script>

<template>
  <div class="json-tree-viewer font-mono text-xs select-none">
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
