import { getClipboardText, getTossShareLink, setClipboardText, share } from '@apps-in-toss/web-framework'
import type { Reply } from '../types'

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

function encodeReplies(replies: Reply[]) {
  const payload = replies.map(({ text, label, reason }) => ({ text, label, reason }))
  return encodeURIComponent(btoa(unescape(encodeURIComponent(JSON.stringify(payload)))))
}

export async function sharePoll(replies: Reply[]): Promise<boolean> {
  const data = encodeReplies(replies)
  const path = `intoss://replaypick/poll?data=${data}`
  try {
    const link = await getTossShareLink(path)
    await share({ message: `내 답장 후보 중 뭐가 제일 자연스러워?\n\n${link}` })
    return true
  } catch {
    const fallback = `${window.location.origin}${window.location.pathname}?screen=poll&data=${data}`
    try {
      await navigator.share({ title: '답장픽', text: '내 답장 후보 중 뭐가 제일 자연스러워?', url: fallback })
      return true
    } catch {
      return copyText(fallback)
    }
  }
}

export function decodeSharedReplies(encoded: string | null): Reply[] {
  if (!encoded) return []
  try {
    const json = decodeURIComponent(escape(atob(decodeURIComponent(encoded))))
    const parsed = JSON.parse(json) as Array<{ text: string; label: string; reason: string }>
    return parsed.slice(0, 3).map((reply, index) => ({ ...reply, id: `shared-${index}-${reply.text.slice(0, 8)}` }))
  } catch {
    return []
  }
}

export function trackEvent(name: string, properties?: Record<string, string | number | boolean>) {
  if (import.meta.env.DEV) console.info(`[ReplyPick] ${name}`, properties ?? '')
}
