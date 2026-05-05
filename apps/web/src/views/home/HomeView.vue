<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { BookOpen, Plus, Search, Settings } from 'lucide-vue-next'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { uuid } from '@/lib/utils'
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { createNovel } from '@/db/novels'
import { useNovelList } from '@/composables/useNovelList'
import { getAllModels } from '@/composables/useModels'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import NovelCard from './components/NovelCard.vue'
import NewStoryDialog from './components/NewStoryDialog.vue'

const COVER_COLORS = [
  'bg-blue-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-violet-500',
  'bg-teal-500',
  'bg-orange-500',
  'bg-indigo-500',
]

const { t } = useI18n()

function getCoverColor(id: string): string {
  let hash = 0
  for (let i = 0; i < id.length; i++) {
    hash = (hash << 5) - hash + id.charCodeAt(i)
  }
  return COVER_COLORS[Math.abs(hash) % COVER_COLORS.length]
}

const {
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
} = useNovelList()

const router = useRouter()

const newStoryDialogOpen = ref(false)
const noModelDialogOpen = ref(false)

async function openCreateDialog() {
  try {
    const allModels = await getAllModels()
    if (allModels.length === 0) {
      noModelDialogOpen.value = true
      return
    }
    newStoryDialogOpen.value = true
  } catch {
    noModelDialogOpen.value = true
  }
}

async function handleCreateStory(selectedPromptIds: string[]) {
  try {
    const id = uuid()
    await createNovel({
      id,
      title: t('home.newStory'),
      synopsis: '',
      genre: '',
      targetWordCount: 0,
      currentWordCount: 0,
      status: 'drafting',
      styleSettings: {
        narrativePerspective: '',
        tense: '',
        languageStyle: '',
      },
      selectedPromptIds,
      createdAt: Date.now(),
      updatedAt: Date.now(),
      version: 1,
    })
    newStoryDialogOpen.value = false
    router.push(`/story/${id}?tab=agent`)
  } catch (e) {
    toast.error(t('home.newStoryDialog.loadPromptsFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Loading State -->
    <template v-if="loading">
      <section class="rounded-xl border bg-card shadow-sm p-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="i in 4" :key="i" class="h-24 rounded-xl bg-muted animate-pulse" />
        </div>
      </section>
    </template>

    <!-- Error State -->
    <template v-else-if="error">
      <section
        class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center"
      >
        <h3 class="text-sm font-medium mb-1">{{ $t('common.loadFailed') }}</h3>
        <p class="text-xs text-muted-foreground mb-4">{{ $t('common.loadFailedHint') }}</p>
        <button
          class="text-sm text-primary underline underline-offset-2 hover:text-primary/80 transition-colors cursor-pointer"
          @click="loadNovels"
        >
          {{ $t('common.retry') }}
        </button>
      </section>
    </template>

    <!-- Loaded State -->
    <template v-else>
      <!-- Toolbar -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search
            class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          />
          <Input v-model="searchQuery" :placeholder="$t('home.searchPlaceholder')" class="pl-8" />
        </div>
        <Button
          v-if="novels.length > 0"
          size="sm"
          class="shrink-0 gap-1.5"
          @click="openCreateDialog"
        >
          <Plus class="size-4" />
          {{ $t('home.createButton') }}
        </Button>
      </div>

      <!-- Empty State -->
      <template v-if="novels.length === 0">
        <section
          class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center"
        >
          <BookOpen class="size-12 mb-4 text-muted-foreground/30" />
          <h3 class="text-sm font-medium mb-1">{{ $t('home.empty.title') }}</h3>
          <p class="text-xs text-muted-foreground mb-6">{{ $t('home.empty.description') }}</p>
          <Button @click="openCreateDialog">
            <Plus class="size-4" />
            {{ $t('home.empty.button') }}
          </Button>
        </section>
      </template>

      <!-- Empty search results -->
      <template v-else-if="filteredNovels.length === 0">
        <section
          class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center"
        >
          <Search class="size-8 mb-3 text-muted-foreground/30" />
          <p class="text-sm text-muted-foreground">{{ $t('home.noResults') }}</p>
        </section>
      </template>

      <!-- Novel Grid -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <NovelCard
          v-for="novel in filteredNovels"
          :key="novel.id"
          :novel="novel"
          :cover-color="getCoverColor(novel.id)"
          @open="openStory"
          @delete="handleDelete"
        />
      </section>
    </template>
  </div>

  <!-- No Model Warning Dialog -->
  <Dialog v-model:open="noModelDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('home.noModel.title') }}</DialogTitle>
        <DialogDescription>
          {{ $t('home.noModel.description') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline">{{ $t('common.cancel') }}</Button>
        </DialogClose>
        <Button
          class="gap-1.5"
          @click="
            () => {
              noModelDialogOpen = false
              router.push('/settings/model')
            }
          "
        >
          <Settings class="size-4" />
          {{ $t('home.noModel.goConfig') }}
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- New Story Dialog -->
  <NewStoryDialog
    :open="newStoryDialogOpen"
    @update:open="newStoryDialogOpen = $event"
    @create="handleCreateStory"
  />

  <!-- Delete Confirmation Dialog -->
  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('common.confirmDelete') }}</DialogTitle>
        <DialogDescription>
          {{
            $t('home.deleteConfirm.description', {
              title: novelToDelete?.title || $t('home.card.untitled'),
            })
          }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <DialogClose as-child>
          <Button variant="outline">{{ $t('common.cancel') }}</Button>
        </DialogClose>
        <Button variant="destructive" @click="confirmDelete">{{ $t('common.delete') }}</Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
</template>
