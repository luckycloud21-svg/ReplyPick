declare const process: { env: Record<string, string | undefined> }

type ServerRequest = {
  method?: string
  body?: unknown
}

type ServerResponse = {
  setHeader: (name: string, value: string) => void
  status: (code: number) => ServerResponse
  json: (body: unknown) => void
  end: () => void
}

type ReplyInput = {
  message?: unknown
  relation?: unknown
  tone?: unknown
}

type GeminiResponse = {
  candidates?: Array<{
    content?: {
      parts?: Array<{ text?: unknown }>
    }
  }>
}

const GEMINI_API_BASE = 'https://generativelanguage.googleapis.com/v1beta/models'
const MAX_MESSAGE_LENGTH = 1500

const geminiResponseSchema = {
  type: 'OBJECT',
  properties: {
    replies: {
      type: 'ARRAY',
      items: {
        type: 'OBJECT',
        properties: {
          text: { type: 'STRING' },
          label: { type: 'STRING' },
          reason: { type: 'STRING' },
        },
        required: ['text', 'label', 'reason'],
      },
    },
    risk: {
      type: 'STRING',
      enum: ['low', 'medium', 'high'],
    },
  },
  required: ['replies', 'risk'],
} as const

const safeReplies = [
  {
    text: '지금은 바로 답하지 않고, 먼저 안전한 사람이나 전문기관에 도움을 요청해 주세요.',
    label: '안전을 먼저',
    reason: '위험한 상황에서는 답장보다 안전 확인이 우선이에요.',
  },
  {
    text: '이 내용은 혼자 감당하기 어려워 보여요. 가까운 사람이나 전문기관에 바로 알려보세요.',
    label: '도움 요청',
    reason: '혼자 판단하지 않고 주변의 도움을 받을 수 있도록 안내해요.',
  },
  {
    text: '많이 힘든 상황이라면 지금 곁에 있는 사람에게 알려 주세요. 긴급하면 112 또는 119에 연락하세요.',
    label: '차분하게 안내',
    reason: '감정적인 대화를 멈추고 필요한 도움으로 연결하는 답장이에요.',
  },
]

function jsonBody(body: unknown): ReplyInput {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body) as ReplyInput
    } catch {
      return {}
    }
  }
  return body && typeof body === 'object' ? body as ReplyInput : {}
}

function cleanText(value: unknown, maxLength: number) {
  return typeof value === 'string'
    ? value.replace(/[\u0000-\u001F\u007F]/g, '').trim().slice(0, maxLength)
    : ''
}

function isHighRisk(message: string) {
  return /(자해|죽고 싶|죽고싶|극단적 선택|마약|폭력|칼로|때려|성폭력|협박|죽여)/i.test(message)
}

function outputText(response: GeminiResponse) {
  const parts = response.candidates?.[0]?.content?.parts ?? []
  return parts
    .map((part) => typeof part.text === 'string' ? part.text : '')
    .join('')
}

function validReplies(value: unknown): value is Array<{ text: string; label: string; reason: string }> {
  if (!Array.isArray(value) || value.length !== 3) return false

  const texts = value.map((reply) => {
    if (!reply || typeof reply !== 'object') return ''
    const text = (reply as { text?: unknown }).text
    return typeof text === 'string' ? text.trim() : ''
  })

  return texts.every((text) => text.length > 0 && text.length <= 240)
    && new Set(texts).size === 3
}

export default async function handler(req: ServerRequest, res: ServerResponse) {
  const allowOrigin = process.env.REPLY_API_ALLOW_ORIGIN || '*'
  res.setHeader('Access-Control-Allow-Origin', allowOrigin)
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Cache-Control', 'no-store')

  if (req.method === 'OPTIONS') {
    res.status(204).end()
    return
  }

  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' })
    return
  }

  const apiKey = process.env.GEMINI_API_KEY
  if (!apiKey) {
    res.status(503).json({ error: 'ai_not_configured' })
    return
  }

  const body = jsonBody(req.body)
  const message = cleanText(body.message, MAX_MESSAGE_LENGTH)
  const relation = cleanText(body.relation, 30)
  const tone = cleanText(body.tone, 30)

  if (message.length < 10 || !relation || !tone) {
    res.status(400).json({ error: 'invalid_input' })
    return
  }

  if (isHighRisk(message)) {
    res.status(200).json({ replies: safeReplies, risk: 'high' })
    return
  }

  const model = process.env.GEMINI_MODEL || 'gemini-3.7-flash'
  const models = [...new Set([model, 'gemini-3.7-flash'])]
  const prompt = [
    '너는 한국어 메신저 답장 추천 서비스 ReplyPick의 답장 생성 AI야.',
    '사용자가 받은 메시지를 바탕으로 바로 보낼 수 있는 자연스러운 답장 3개를 만들어.',
    '세 답장은 서로 다른 방향이어야 해: A는 가장 무난하고, B는 조금 더 자연스럽고, C는 짧고 깔끔하게 작성해.',
    '관계와 원하는 말투를 반드시 반영해.',
    '답장은 한국어 1~2문장, 240자 이하로 작성해. AI나 생성이라는 표현, 과도한 설명, 개인정보 추측은 넣지 마.',
    '반드시 지정된 JSON 형식만 반환해.',
    '',
    `받은 메시지: ${message}`,
    `관계: ${relation}`,
    `원하는 말투: ${tone}`,
  ].join('\n')

  try {
    let upstream: Response | undefined
    let providerStatus = 502
    let providerError = ''

    for (const candidateModel of models) {
      const candidateResponse = await fetch(
        `${GEMINI_API_BASE}/${encodeURIComponent(candidateModel)}:generateContent`,
        {
          method: 'POST',
          headers: {
            'content-type': 'application/json',
            'x-goog-api-key': apiKey,
          },
          body: JSON.stringify({
            contents: [{ role: 'user', parts: [{ text: prompt }] }],
            generationConfig: {
              responseMimeType: 'application/json',
              responseSchema: geminiResponseSchema,
              maxOutputTokens: 700,
            },
          }),
        },
      )

      if (candidateResponse.ok) {
        upstream = candidateResponse
        break
      }

      providerStatus = candidateResponse.status
      providerError = (await candidateResponse.text()).slice(0, 1000)
      console.error('[ReplyPick] Gemini API error', candidateModel, providerStatus, providerError)

      // Gemini can temporarily return 429/5xx for a busy model. Try the stable
      // fallback model before returning an error to the app.
      if (![404, 429, 500, 502, 503, 504].includes(providerStatus)) break
    }

    if (!upstream) {
      let providerMessage = providerError
      try {
        const parsedError = JSON.parse(providerError) as { error?: { message?: unknown } }
        if (typeof parsedError.error?.message === 'string') providerMessage = parsedError.error.message
      } catch {
        // Keep the raw, truncated provider response for non-JSON errors.
      }
      res.status(502).json({
        error: 'ai_upstream_error',
        provider_status: providerStatus,
        provider_message: providerMessage.slice(0, 300),
      })
      return
    }

    const response = await upstream.json() as GeminiResponse
    const text = outputText(response)
    let parsed: { replies?: unknown; risk?: unknown }

    try {
      parsed = JSON.parse(text) as { replies?: unknown; risk?: unknown }
    } catch {
      res.status(502).json({ error: 'ai_invalid_json' })
      return
    }

    if (!validReplies(parsed.replies)) {
      res.status(502).json({ error: 'ai_invalid_schema' })
      return
    }

    const risk = parsed.risk === 'high' || parsed.risk === 'medium' ? parsed.risk : 'low'
    res.status(200).json({ replies: parsed.replies, risk })
  } catch {
    res.status(502).json({ error: 'ai_request_failed' })
  }
}
