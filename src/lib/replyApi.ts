import { generateReplies, sanitizeMessage } from './replyEngine'
import type { Relation, Reply, Tone } from '../types'

type ReplyApiResponse = { replies?: Array<{ text?: unknown; label?: unknown; reason?: unknown }>; risk?: unknown }

export class ReplyGenerationError extends Error {
  constructor(message = 'Reply API is unavailable') {
    super(message)
    this.name = 'ReplyGenerationError'
  }
}

function isValidReply(value: ReplyApiResponse['replies']): value is Array<{ text: string; label: string; reason: string }> {
  if (!Array.isArray(value) || value.length < 3) return false
  const texts = value.slice(0, 3).map((reply) => typeof reply.text === 'string' ? reply.text.trim() : '')
  return texts.every((text) => text.length > 0 && text.length <= 240) && new Set(texts).size === 3
}

/**
 * VITE_REPLY_API_URL이 없을 때만 개발용 로컬 엔진을 사용합니다.
 * 운영 API가 설정된 상태에서 실패하면 로컬 문장으로 위장하지 않고 오류를 반환합니다.
 */
export async function requestReplies(message: string, relation: Relation, tone: Tone): Promise<Reply[]> {
  const endpoint = import.meta.env.VITE_REPLY_API_URL as string | undefined
  const clean = sanitizeMessage(message)
  if (!endpoint) {
    if (import.meta.env.DEV) return generateReplies(clean, relation, tone)
    throw new ReplyGenerationError('ai_not_configured')
  }

  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), 6000)
  try {
    const response = await fetch(`${endpoint.replace(/\/$/, '')}/v1/replies`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ message: clean, relation, tone, length: 'short' }),
      signal: controller.signal,
    })
    if (!response.ok) throw new ReplyGenerationError(`reply-api-${response.status}`)
    const payload = await response.json() as ReplyApiResponse
    if (!isValidReply(payload.replies)) throw new ReplyGenerationError('invalid-reply-schema')
    return payload.replies.slice(0, 3).map((reply, index) => ({
      id: `api-reply-${Date.now()}-${index}`,
      text: reply.text.trim(),
      label: reply.label.trim() || ['가장 무난', '조금 더 자연스럽게', '짧고 깔끔하게'][index],
      reason: reply.reason.trim() || 'AI가 상황에 맞게 다듬은 표현이에요.',
    }))
  } catch (error) {
    if (error instanceof ReplyGenerationError) throw error
    throw new ReplyGenerationError(error instanceof Error ? error.message : 'reply-api-failed')
  } finally {
    window.clearTimeout(timeout)
  }
}
