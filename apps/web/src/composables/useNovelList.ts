import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { getAllNovels, deleteNovel } from '@/db/novels'
import type { Novel } from '@/db/types'
import { toast } from 'vue-sonner'

export function useNovelList() {
  const router = useRouter()

  const novels = ref<Novel[]>([])
  const loading = ref(true)
  const error = ref(false)
  const searchQuery = ref('')
  const deleteDialogOpen = ref(false)
  const novelToDelete = ref<Novel | null>(null)

  const filteredNovels = computed(() => {
    if (!searchQuery.value.trim()) return novels.value
    const q = searchQuery.value.toLowerCase()
    return novels.value.filter(
      (n) => n.title.toLowerCase().includes(q) || (n.synopsis || '').toLowerCase().includes(q),
    )
  })

  onMounted(loadNovels)

  async function loadNovels() {
    loading.value = true
    error.value = false
    try {
      const all = await getAllNovels()
      novels.value = all.sort((a, b) => b.updatedAt - a.updatedAt)
    } catch {
      error.value = true
    } finally {
      loading.value = false
    }
  }

  function openStory(novel: Novel) {
    if (novel.status === 'drafting' && !novel.synopsis) {
      router.push(`/story/${novel.id}?tab=agent`)
    } else {
      router.push(`/story/${novel.id}`)
    }
  }

  function handleDelete(novel: Novel) {
    novelToDelete.value = novel
    deleteDialogOpen.value = true
  }

  async function confirmDelete() {
    const novel = novelToDelete.value
    if (!novel) return
    try {
      await deleteNovel(novel.id)
      novels.value = novels.value.filter((n) => n.id !== novel.id)
    } catch (e) {
      toast.error('删除失败', {
        description: e instanceof Error ? e.message : String(e),
      })
    } finally {
      deleteDialogOpen.value = false
      novelToDelete.value = null
    }
  }

  return {
    novels,
    loading,
    error,
    searchQuery,
    filteredNovels,
    deleteDialogOpen,
    novelToDelete,
    loadNovels,
    openStory,
    handleDelete,
    confirmDelete,
  }
}
