import { ref, onMounted, onUnmounted } from 'vue'
import { getDB } from '@/db'
import type { Conversation } from '@/db/types'

const SESSION_KEY = 'storyclaw:sessions'

interface SessionRecord {
  start: number
  end?: number
}

function isToday(ts: number): boolean {
  const d = new Date(ts)
  const n = new Date()
  return d.getFullYear() === n.getFullYear()
    && d.getMonth() === n.getMonth()
    && d.getDate() === n.getDate()
}

function formatDuration(totalSeconds: number): string {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h} 小时 ${m} 分钟`
  if (m > 0) return `${m} 分钟 ${s} 秒`
  return `${s} 秒`
}

const SESSION_START = Date.now()

function persistSessionStart(): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    const sessions: SessionRecord[] = raw ? JSON.parse(raw) : []
    sessions.push({ start: SESSION_START })
    const cutoff = Date.now() - 7 * 24 * 60 * 60 * 1000
    localStorage.setItem(SESSION_KEY, JSON.stringify(sessions.filter((s) => s.start > cutoff)))
  } catch {
    /* localStorage may be unavailable */
  }
}

function closeSessionOnUnload(): void {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return
    const sessions: SessionRecord[] = JSON.parse(raw)
    const session = sessions.find((s) => s.start === SESSION_START && !s.end)
    if (session) {
      session.end = Date.now()
      localStorage.setItem(SESSION_KEY, JSON.stringify(sessions))
    }
  } catch {
  }
}

persistSessionStart()
if (typeof window !== 'undefined') {
  window.addEventListener('beforeunload', closeSessionOnUnload)
}

function getTodaySessionSeconds(): number {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return 0
    const sessions: SessionRecord[] = JSON.parse(raw)
    let total = 0
    for (const s of sessions) {
      if (!isToday(s.start)) continue
      if (s.end) {
        total += s.end - s.start
      } else if (s.start === SESSION_START) {
        total += Date.now() - s.start
      }
    }
    return Math.floor(total / 1000)
  } catch {
    return 0
  }
}

export function useStats() {
  const todayWordCount = ref(0)
  const todayTokens = ref(0)
  const todayUsageSeconds = ref(0)
  const loading = ref(true)
  const durationText = ref('')

  let tickTimer: ReturnType<typeof setInterval> | null = null

  function refreshUsageTime() {
    todayUsageSeconds.value = getTodaySessionSeconds()
    durationText.value = formatDuration(todayUsageSeconds.value)
  }

  async function loadWordCount() {
    try {
      const db = await getDB()
      const allValues = await db.getAll('chapters')
      let count = 0
      for (const ch of allValues) {
        if (isToday(ch.updatedAt)) {
          count += ch.wordCount
        }
      }
      todayWordCount.value = count
    } catch {
    }
  }

  async function loadTokenUsage() {
    try {
      const db = await getDB()
      const conversations: Conversation[] = await db.getAll('conversations')
      let tokens = 0
      for (const conv of conversations) {
        for (const msg of conv.messages) {
          if (isToday(msg.timestamp) && msg.promptTokens != null) {
            tokens += (msg.promptTokens || 0) + (msg.completionTokens || 0)
          }
        }
      }
      todayTokens.value = tokens
    } catch {
    }
  }

  onMounted(async () => {
    await Promise.all([loadWordCount(), loadTokenUsage()])
    refreshUsageTime()
    loading.value = false
    tickTimer = setInterval(refreshUsageTime, 10_000)
  })

  onUnmounted(() => {
    if (tickTimer) clearInterval(tickTimer)
  })

  return {
    todayWordCount,
    todayTokens,
    todayUsageSeconds,
    loading,
    durationText,
  }
}
