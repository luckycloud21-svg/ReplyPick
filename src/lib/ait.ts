import { getClipboardText, getTossShareLink, setClipboardText, share } from '@apps-in-toss/web-framework'
import type { Reply } from '../types'

export type SharedPoll = {
  question: string
  replies: Reply[]
}

export type SharedVote = {
  question: string
  reply: Reply
  index: number
}

const canUseNavigatorClipboard = () => typeof navigator !== 'undefined' && Boolean(navigator.clipboard)

export async function readClipboard(): Promise<string> {
  try {
    const text = await getClipboardText()
    return text || ''
  } catch {
    if (canUseNavigatorClipboard()) {
      try {
        return await navigator.clipboard.readText()
      } catch {
        return ''
      }
    }
    return ''
  }
}

export async function copyText(text: string): Promise<boolean> {
  try {
    await setClipboardText(text)
    return true
  } catch {
    if (canUseNavigatorClipboard()) {
      try {
        await navigator.clipboard.writeText(text)
        return true
      } catch {
        return false
      }
    }
    return false
  }
}

function encodePayload(payload: unknown) {
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))))
}

function decodePayload(encoded: string | null): unknown | null {
  if (!encoded) return null
  try {
    return JSON.parse(decodeURIComponent(escape(atob(decodeURIComponent(encoded)))))
  } catch {
    return null
  }
}

function normalizeQuestion(question: string) {
  return question.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, 1500) || '이 답장 후보 중 어떤 게 가장 자연스러울까?'
}

function normalizeReplies(replies: Reply[]): Reply[] {
  return replies.slice(0, 3).map((reply, index) => ({
    id: reply.id || `shared-${index}-${reply.text.slice(0, 8)}`,
    text: reply.text.slice(0, 240),
    label: reply.label.slice(0, 40),
    reason: reply.reason.slice(0, 100),
  }))
}

export async function sharePoll(question: string, replies: Reply[]): Promise<boolean> {
  const payload = { question: normalizeQuestion(question), replies: normalizeReplies(replies) }
  const data = encodePayload(payload)
  const path = `intoss://replaypick/poll?data=${data}`
  try {
    const link = await getTossShareLink(path)
    await share({ message: `답장픽 질문이에요. 친구라면 어떤 답장이 좋을까요?\n\n질문: ${payload.question}\n\n${link}` })
    return true
  } catch {
    const fallback = `${window.location.origin}${window.location.pathname}?screen=poll&data=${data}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: '답장픽 질문', text: `질문: ${payload.question}`, url: fallback })
        return true
      }
    } catch {
      // 공유 시트를 닫은 경우 링크 복사 fallback으로 이어집니다.
    }
    return copyText(fallback)
  }
}

export async function shareVote(question: string, reply: Reply, index = 0): Promise<boolean> {
  const payload = { question: normalizeQuestion(question), reply: normalizeReplies([reply])[0], index }
  const data = encodePayload(payload)
  const path = `intoss://replaypick/vote-result?data=${data}`
  try {
    const link = await getTossShareLink(path)
    await share({ message: `답장픽 투표 결과를 보냈어요.\n\n질문: ${payload.question}\n선택: ${payload.reply.text}\n\n${link}` })
    return true
  } catch {
    const fallback = `${window.location.origin}${window.location.pathname}?screen=vote-result&data=${data}`
    try {
      if (typeof navigator.share === 'function') {
        await navigator.share({ title: '답장픽 투표 결과', text: `선택한 답장: ${payload.reply.text}`, url: fallback })
        return true
      }
    } catch {
      // 공유 시트를 닫은 경우 링크 복사 fallback으로 이어집니다.
    }
    return copyText(fallback)
  }
}

export function decodeSharedPoll(encoded: string | null): SharedPoll | null {
  const parsed = decodePayload(encoded)
  if (!parsed || typeof parsed !== 'object') return null
  const value = parsed as { question?: unknown; replies?: unknown }

  // 이전 버전에서 생성된 답장-only 링크도 계속 열 수 있게 유지합니다.
  if (Array.isArray(parsed)) {
    const replies = normalizeReplies(parsed as Reply[])
    return replies.length === 3 ? { question: '이 답장 후보 중 어떤 게 가장 자연스러울까?', replies } : null
  }
  if (typeof value.question !== 'string' || !Array.isArray(value.replies)) return null
  const replies = normalizeReplies(value.replies as Reply[])
  return replies.length === 3 ? { question: normalizeQuestion(value.question), replies } : null
}

export function decodeSharedVote(encoded: string | null): SharedVote | null {
  const parsed = decodePayload(encoded)
  if (!parsed || typeof parsed !== 'object') return null
  const value = parsed as { question?: unknown; reply?: unknown; index?: unknown }
  if (typeof value.question !== 'string' || !value.reply || typeof value.reply !== 'object') return null
  const reply = normalizeReplies([value.reply as Reply])[0]
  return reply ? { question: normalizeQuestion(value.question), reply, index: typeof value.index === 'number' ? Math.max(0, Math.min(2, value.index)) : 0 } : null
}

export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  if (import.meta.env.DEV) console.info(`[ReplyPick] ${name}`, properties ?? '')
}
