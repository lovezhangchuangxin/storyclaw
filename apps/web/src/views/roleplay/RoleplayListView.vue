<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { Drama, Plus, Search, Server, Settings, Trash2 } from 'lucide-vue-next'
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
import { getAllRoleplaySessions, deleteRoleplaySession } from '@/db/roleplay-sessions'
import { getPromptById } from '@/db/prompts'
import { getAllModels } from '@/composables/useModels'
import { toast } from 'vue-sonner'
import { useI18n } from 'vue-i18n'
import { relativeTime } from '@/lib/time'
import type { RoleplaySession } from '@/db/roleplay-types'
import NewRoleplayDialog from './components/NewRoleplayDialog.vue'

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

const sessions = ref<RoleplaySession[]>([])
const loading = ref(true)
const searchQuery = ref('')

const filteredSessions = ref<RoleplaySession[]>([])
const newDialogOpen = ref(false)
const noModelDialogOpen = ref(false)
const deleteDialogOpen = ref(false)
const sessionToDelete = ref<RoleplaySession | null>(null)

const promptNames = ref<Record<string, string>>({})

async function loadSessions() {
  loading.value = true
  try {
    const all = await getAllRoleplaySessions()
    sessions.value = all.sort((a, b) => b.updatedAt - a.updatedAt)
    filteredSessions.value = sessions.value
    // Load prompt names
    const names: Record<string, string> = {}
    for (const session of all) {
      if (!names[session.promptId]) {
        const prompt = await getPromptById(session.promptId)
        names[session.promptId] = prompt?.name ?? ''
      }
    }
    promptNames.value = names
  } catch (e) {
    toast.error(t('common.loadFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
    console.error('[RoleplayListView] loadSessions failed:', e)
  } finally {
    loading.value = false
  }
}

function filterSessions() {
  const q = searchQuery.value.toLowerCase()
  filteredSessions.value = q
    ? sessions.value.filter(
        (s) =>
          s.title.toLowerCase().includes(q) ||
          (promptNames.value[s.promptId] ?? '').toLowerCase().includes(q),
      )
    : sessions.value
}

async function openCreateDialog() {
  try {
    const allModels = await getAllModels()
    if (allModels.length === 0) {
      noModelDialogOpen.value = true
      return
    }
    newDialogOpen.value = true
  } catch {
    noModelDialogOpen.value = true
  }
}

async function handleCreateSession(promptId: string) {
  try {
    const prompt = await getPromptById(promptId)
    const id = uuid()
    const { saveRoleplaySession } = await import('@/db/roleplay-sessions')
    await saveRoleplaySession({
      id,
      promptId,
      title: prompt?.name ?? t('roleplay.list.card.untitled'),
      sidebarData: null,
      createdAt: Date.now(),
      updatedAt: Date.now(),
    })
    newDialogOpen.value = false
    router.push(`/roleplay/${id}`)
  } catch (e) {
    toast.error(t('common.saveFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  }
}

function handleDelete(session: RoleplaySession) {
  sessionToDelete.value = session
  deleteDialogOpen.value = true
}

async function confirmDelete() {
  if (!sessionToDelete.value) return
  try {
    await deleteRoleplaySession(sessionToDelete.value.id)
    sessions.value = sessions.value.filter((s) => s.id !== sessionToDelete.value!.id)
    filterSessions()
  } catch (e) {
    toast.error(t('common.deleteFailed'), {
      description: e instanceof Error ? e.message : String(e),
    })
  } finally {
    deleteDialogOpen.value = false
    sessionToDelete.value = null
  }
}

const router = useRouter()

onMounted(loadSessions)
</script>

<template>
  <div class="max-w-3xl mx-auto p-4 md:p-6 space-y-5">
    <!-- Loading -->
    <template v-if="loading">
      <section class="rounded-xl border bg-card shadow-sm p-5">
        <div class="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div v-for="i in 4" :key="i" class="h-24 rounded-xl bg-muted animate-pulse" />
        </div>
      </section>
    </template>

    <!-- Loaded -->
    <template v-else>
      <!-- Toolbar -->
      <div class="flex items-center gap-2">
        <div class="relative flex-1">
          <Search
            class="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none"
          />
          <Input
            v-model="searchQuery"
            :placeholder="$t('home.searchPlaceholder')"
            class="pl-8"
            @input="filterSessions"
          />
        </div>
        <Button
          v-if="sessions.length > 0"
          size="sm"
          class="shrink-0 gap-1.5"
          @click="openCreateDialog"
        >
          <Plus class="size-4" />
          {{ $t('roleplay.list.newSession') }}
        </Button>
      </div>

      <!-- Empty State -->
      <template v-if="sessions.length === 0">
        <section
          class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center"
        >
          <Drama class="size-12 mb-4 text-muted-foreground/30" />
          <h3 class="text-sm font-medium mb-1">{{ $t('roleplay.list.empty.title') }}</h3>
          <p class="text-xs text-muted-foreground mb-6">
            {{ $t('roleplay.list.empty.description') }}
          </p>
          <Button @click="openCreateDialog">
            <Plus class="size-4" />
            {{ $t('roleplay.list.empty.button') }}
          </Button>
        </section>
      </template>

      <!-- Empty search -->
      <template v-else-if="filteredSessions.length === 0">
        <section
          class="rounded-xl border bg-card shadow-sm p-12 flex flex-col items-center justify-center text-center"
        >
          <Search class="size-8 mb-3 text-muted-foreground/30" />
          <p class="text-sm text-muted-foreground">{{ $t('home.noResults') }}</p>
        </section>
      </template>

      <!-- Session Grid -->
      <section v-else class="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div
          v-for="session in filteredSessions"
          :key="session.id"
          class="relative rounded-xl border bg-card text-left overflow-hidden transition-all duration-200 hover:shadow-md hover:border-primary/30 group cursor-pointer"
          role="button"
          tabindex="0"
          @click="router.push(`/roleplay/${session.id}`)"
          @keydown.enter="router.push(`/roleplay/${session.id}`)"
        >
          <div class="p-4">
            <div class="flex items-start justify-between gap-2">
              <div class="flex items-center gap-2 min-w-0">
                <span class="size-2 rounded-full shrink-0" :class="getCoverColor(session.id)" />
                <h3
                  class="font-semibold text-sm leading-snug line-clamp-1 group-hover:text-primary transition-colors"
                >
                  {{ session.title || $t('roleplay.list.card.untitled') }}
                </h3>
              </div>
              <button
                class="size-7 shrink-0 flex items-center justify-center rounded-md text-muted-foreground opacity-0 group-hover:opacity-100 hover:text-destructive hover:bg-destructive/10 transition-all"
                @click.stop="handleDelete(session)"
                :title="$t('common.delete')"
              >
                <Trash2 class="size-3.5" />
              </button>
            </div>
            <p
              v-if="promptNames[session.promptId]"
              class="text-xs text-muted-foreground mt-1 truncate"
            >
              {{ promptNames[session.promptId] }}
            </p>
            <div class="mt-3 flex items-center justify-between">
              <span class="text-[11px] text-muted-foreground">{{
                relativeTime(session.updatedAt)
              }}</span>
            </div>
          </div>
        </div>
      </section>
    </template>
  </div>

  <!-- No Model Dialog -->
  <Dialog v-model:open="noModelDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('home.noModel.title') }}</DialogTitle>
        <DialogDescription>
          {{ $t('home.noModel.description') }}
        </DialogDescription>
      </DialogHeader>
      <DialogFooter class="flex-col gap-2 sm:flex-col">
        <Button
          class="w-full gap-1.5"
          @click="
            () => {
              noModelDialogOpen = false
              router.push('/settings/server')
            }
          "
        >
          <Server class="size-4" />
          {{ $t('home.noModel.goServer') }}
        </Button>
        <Button
          variant="outline"
          class="w-full gap-1.5"
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
        <DialogClose as-child>
          <Button variant="ghost" class="w-full">{{ $t('common.cancel') }}</Button>
        </DialogClose>
      </DialogFooter>
    </DialogContent>
  </Dialog>

  <!-- New Session Dialog -->
  <NewRoleplayDialog
    :open="newDialogOpen"
    @update:open="newDialogOpen = $event"
    @create="handleCreateSession"
  />

  <!-- Delete Confirmation -->
  <Dialog v-model:open="deleteDialogOpen">
    <DialogContent class="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>{{ $t('common.confirmDelete') }}</DialogTitle>
        <DialogDescription>
          {{
            $t('roleplay.list.deleteConfirm.description', {
              title: sessionToDelete?.title || $t('roleplay.list.card.untitled'),
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
