import { ref, type Ref } from 'vue'

export function usePromptDrag(selectedIds: Ref<string[]>) {
  const dragIndex = ref<number | null>(null)
  const dragOverIndex = ref<number | null>(null)
  const dragTarget = ref<Element | null>(null)
  const dragPointerId = ref<number | null>(null)

function onPointerDown(e: PointerEvent, idx: number) {
  const grip = e.currentTarget as Element
  grip.setPointerCapture(e.pointerId)
  dragTarget.value = grip as HTMLElement
    dragIndex.value = idx
    dragPointerId.value = e.pointerId
  }

  function onPointerMove(e: PointerEvent) {
    if (dragIndex.value === null) return
    const listEl = (e.currentTarget as HTMLElement).closest('[data-sortable-list]')
    if (!listEl) return
    const items = listEl.querySelectorAll('[data-sortable-item]')
    let closest = dragIndex.value
    let minDist = Infinity
    items.forEach((el, i) => {
      const rect = el.getBoundingClientRect()
      const midY = rect.top + rect.height / 2
      const dist = Math.abs(e.clientY - midY)
      if (dist < minDist) {
        minDist = dist
        closest = i
      }
    })
    dragOverIndex.value = closest
  }

  function onPointerUp() {
    if (dragIndex.value === null) return
    if (
      dragOverIndex.value !== null &&
      dragOverIndex.value !== dragIndex.value
    ) {
      const arr = [...selectedIds.value]
      const [moved] = arr.splice(dragIndex.value, 1)
      arr.splice(dragOverIndex.value, 0, moved)
      selectedIds.value = arr
    }
    release()
  }

  function onPointerCancel() {
    release()
  }

  function release() {
    if (dragTarget.value && dragPointerId.value !== null) {
      dragTarget.value.releasePointerCapture(dragPointerId.value)
    }
    dragIndex.value = null
    dragOverIndex.value = null
    dragTarget.value = null
    dragPointerId.value = null
  }

  function moveUp(id: string) {
    const idx = selectedIds.value.indexOf(id)
    if (idx <= 0) return
    const arr = [...selectedIds.value]
    ;[arr[idx - 1], arr[idx]] = [arr[idx], arr[idx - 1]]
    selectedIds.value = arr
  }

  function moveDown(id: string) {
    const idx = selectedIds.value.indexOf(id)
    if (idx === -1 || idx >= selectedIds.value.length - 1) return
    const arr = [...selectedIds.value]
    ;[arr[idx], arr[idx + 1]] = [arr[idx + 1], arr[idx]]
    selectedIds.value = arr
  }

  return {
    dragIndex,
    dragOverIndex,
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel,
    moveUp,
    moveDown,
  }
}
