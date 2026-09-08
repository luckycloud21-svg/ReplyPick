import { generateReplies, sanitizeMessage } from './replyEngine'
import type { Relation, Reply, Tone } from '../types'

type ReplyApiResponse = { replies?: Array<{ text?: unknown; label?: unknown; reason?: unknown }> }

function isValidReply(value: ReplyApiResponse['replies']): value is Array<{ text: string; label: string; reason: string }> {
  if (!Array.isArray(value) || value.length < 3) return false
  const texts = value.slice(0, 3).map((reply) => typeof reply.text === 'string' ? reply.text.trim() : '')
  return texts.every((text) => text.length > 0 && text.length <= 240) && new Set(texts).size === 3
}

/**
 * 운영 서버가 설정되면 서버 생성 결과를 사용하고, 미설정/장애 시 검수된 로컬 엔진으로 대체합니다.
 * 원문은 이 함수에서 로그로 남기지 않으며, 요청은 6초 안에 끝나도록 제한합니다.
 */
export async function requestReplies(message: string, relation: Relation, tone: Tone): Promise<Reply[]> {
  const endpoint = import.meta.env.VITE_REPLY_API_URL as string | undefined
  const clean = sanitizeMessage(message)
  if (!endpoint) return generateReplies(clean, relation, tone)

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/v1/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: clean, relation, tone, length: 'short' }),
      signal: controller.signal,
    })
    if (!response.ok) throw new Error(`reply-api-${response.status}`)
    const payload = await response.json() as ReplyApiResponse
    if (!isValidReply(payload.replies)) throw new Error('invalid-reply-schema')
    return payload.replies.slice(0, 3).map((reply, index) => ({
      id: `api-reply-${Date.now()}-${index}`,
      text: reply.text.trim(),
      label: reply.label.trim() || ['가장 무난', '조금 더 자연스럽게', '짧고 깔끔하게'][index],
      reason: reply.reason.trim() || '상황에 맞게 다듬은 표현이에요.',
    }))
  } catch {
    return generateReplies(clean, relation, tone)
  } finally {
    window.clearTimeout(timeout)
  }
}
