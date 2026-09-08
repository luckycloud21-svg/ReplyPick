import type { Relation, Reply, ReplySet, Tone } from '../types'

const HISTORY_KEY = 'replypick.history.v1'
const FAVORITES_KEY = 'replypick.favorites.v1'
const USAGE_KEY = 'replypick.usage.v1'

type UsageState = { date: string; generated: number; regenerated: number }

const safeParse = <T>(value: string | null, fallback: T): T => {
  if (!value) return fallback
  try {
    return JSON.parse(value) as T
  } catch {
    return fallback
  }
}

const today = () => new Date().toISOString().slice(0, 10)

export function readHistory(): ReplySet[] {
  return safeParse<ReplySet[]>(localStorage.getItem(HISTORY_KEY), []).slice(0, 20)
}

export function addHistory(set: ReplySet) {
  const next = [set, ...readHistory()].slice(0, 20)
  localStorage.setItem(HISTORY_KEY, JSON.stringify(next))
}

export function deleteHistory(id: string) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(readHistory().filter((item) => item.id !== id)))
}

export function readFavorites(): Reply[] {
  return safeParse<Reply[]>(localStorage.getItem(FAVORITES_KEY), []).slice(0, 100)
}

export function isFavorite(id: string): boolean {
  return readFavorites().some((reply) => reply.id === id)
}

export function toggleFavorite(reply: Reply): boolean {
  const favorites = readFavorites()
  const exists = favorites.some((item) => item.id === reply.id)
  const next = exists ? favorites.filter((item) => item.id !== reply.id) : [reply, ...favorites].slice(0, 100)
  localStorage.setItem(FAVORITES_KEY, JSON.stringify(next))
  return !exists
}

export function readUsage(): UsageState {
  const usage = safeParse<UsageState>(localStorage.getItem(USAGE_KEY), {
    date: today(),
    generated: 0,
    regenerated: 0,
  })
  if (usage.date !== today()) return { date: today(), generated: 0, regenerated: 0 }
  return usage
}

export function trackGeneration(isRegeneration: boolean) {
  const usage = readUsage()
  const next = {
    ...usage,
    generated: usage.generated + 1,
    regenerated: usage.regenerated + (isRegeneration ? 1 : 0),
  }
  localStorage.setItem(USAGE_KEY, JSON.stringify(next))
  return next
}

export function clearLocalData() {
  localStorage.removeItem(HISTORY_KEY)
  localStorage.removeItem(FAVORITES_KEY)
  localStorage.removeItem(USAGE_KEY)
}

export function formatDate(timestamp: number) {
  const date = new Date(timestamp)
  const now = new Date()
  const sameDay = date.toDateString() === now.toDateString()
  if (sameDay) return `오늘 ${date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}`
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return `어제 ${date.toLocaleTimeString('ko-KR', { hour: 'numeric', minute: '2-digit' })}`
  return date.toLocaleDateString('ko-KR', { month: 'numeric', day: 'numeric' })
}

export function buildHistorySet(message: string, relation: Relation, tone: Tone, replies: Reply[]): ReplySet {
  return { id: `set-${Date.now()}`, createdAt: Date.now(), message: message.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 1500), relation, tone, replies }
}
