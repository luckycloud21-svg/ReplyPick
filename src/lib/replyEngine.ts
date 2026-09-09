import type { Relation, Reply, Tone } from '../types'

const removeControls = (message: string) => message.replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '').trim()
const MAX_MESSAGE_LENGTH = 3000

export function sanitizeMessage(message: string) {
  return removeControls(message).slice(0, MAX_MESSAGE_LENGTH)
}

export function validateMessage(message: string) {
  const clean = sanitizeMessage(message)
  if (!clean) return '받은 메시지를 붙여넣어 주세요.'
  return ''
}

function containsHighRisk(message: string) {
  return /(자해|죽고 싶|죽여|폭탄|마약|성착취|불법 해킹|테러|납치)/i.test(message)
}

function getIntent(message: string) {
  if (/(미안|죄송|사과|늦었|실수)/.test(message)) return 'apology'
  if (/(가격|얼마|네고|할인|택배비|거래)/.test(message)) return 'trade'
  if (/(언제|가능|일정|시간|내일|오늘|이번 주|회의|정리)/.test(message)) return 'schedule'
  if (/(고마|감사|도움)/.test(message)) return 'thanks'
  if (/(같이|만나|약속|놀|초대|먹자)/.test(message)) return 'invite'
  if (/(왜|어떻게|뭐야|알려|확인)/.test(message) || message.endsWith('?')) return 'question'
  if (/(싫|안 돼|어렵|거절|취소|못 가|불가)/.test(message)) return 'refusal'
  return 'general'
}

const endings = {
  office: {
    polite: ['확인해보고 말씀드리겠습니다.', '확인했습니다. 일정에 맞춰 진행하겠습니다.', '네, 확인 후 정리해서 공유드리겠습니다.'],
    friendly: ['네, 확인해볼게요!', '좋아요. 확인하고 바로 말씀드릴게요.', '네! 그렇게 진행해볼게요.'],
    short: ['네, 확인할게요.', '네, 알겠습니다.', '확인 후 말씀드릴게요.'],
    firm: ['가능한 범위에서 진행하겠습니다.', '확인 후 정확한 일정으로 말씀드리겠습니다.', '현재 일정상 확인이 먼저 필요합니다.'],
  },
  personal: {
    polite: ['확인해보고 다시 말해줄게요.', '응, 알겠어. 조금만 생각해볼게.', '메시지 고마워. 잘 확인해볼게.'],
    friendly: ['응! 좋아, 확인해볼게 😄', '오케이, 조금만 기다려줘!', '좋아좋아. 곧 답해줄게!'],
    short: ['응, 알겠어.', '오케이!', '확인해볼게.'],
    firm: ['이번에는 어려울 것 같아.', '나는 그렇게 하기는 힘들 것 같아.', '이번 건은 여기까지 할게.'],
  },
}

function context(relation: Relation) {
  return relation === '직장' ? 'office' : 'personal'
}

function toneKey(tone: Tone) {
  if (tone === '공손하게' || tone === '사과') return 'polite'
  if (tone === '친근하게') return 'friendly'
  if (tone === '짧게') return 'short'
  return 'firm'
}

function uniqueReplies(replies: string[]) {
  return [...new Set(replies.map((reply) => reply.replace(/\s+/g, ' ').trim()).filter(Boolean))].slice(0, 3)
}

function makeByIntent(message: string, relation: Relation, tone: Tone): string[] {
  const isOffice = context(relation) === 'office'
  const isPersonal = !isOffice
  const key = toneKey(tone)
  const intent = getIntent(message)
  const pool = isOffice ? endings.office[key] : endings.personal[key]

  if (containsHighRisk(message)) {
    return [
      '지금은 바로 답하지 않고, 안전을 먼저 확인한 뒤 믿을 수 있는 사람에게 도움을 요청해 주세요.',
      '이 내용은 혼자 감당하기 어려워 보여요. 가까운 사람이나 전문기관에 먼저 연락해 보는 게 좋겠습니다.',
      '감정이 가라앉은 뒤 답할게요. 급한 위험이 있다면 즉시 112 또는 119에 연락해 주세요.',
    ]
  }

  if (intent === 'schedule') {
    if (tone === '거절' || tone === '단호하게') return isOffice
      ? ['현재 일정상 내일까지는 어려울 것 같습니다. 가능한 일정을 다시 말씀드리겠습니다.', '요청하신 일정에는 맞추기 어렵습니다. 모레 오전까지는 공유드릴 수 있습니다.', '지금 일정으로는 진행이 어렵습니다. 일정을 조정해 주실 수 있을까요?']
      : ['그 시간은 어려울 것 같아. 다른 날로 잡을까?', '이번 일정은 힘들 것 같아. 가능한 시간 다시 맞춰보자.', '그때는 어려워서 못 갈 것 같아. 미안해!']
    return isOffice
      ? ['네, 내일 오전까지 정리해서 공유드리겠습니다.', '확인했습니다. 내일 오전 중으로 전달드릴게요.', '네, 일정에 맞춰 준비해두겠습니다.']
      : ['응, 그때까지 해둘게!', '좋아, 내일 오전 중으로 보내줄게.', '오케이! 일정 맞춰서 준비해둘게.']
  }

  if (intent === 'apology' || tone === '사과') {
    return isPersonal
      ? ['괜찮아. 말해줘서 고마워.', '이해해. 다음에는 미리 알려주면 좋을 것 같아.', '나도 미안해. 잘 풀고 싶어.']
      : ['괜찮습니다. 확인했습니다. 다음부터 일정에 맞춰 부탁드리겠습니다.', '말씀 주셔서 감사합니다. 이번 건은 확인했으니 후속 조치 부탁드립니다.', '확인했습니다. 같은 일이 반복되지 않도록 한 번만 더 챙겨주세요.']
  }

  if (intent === 'trade') {
    return tone === '거절' || tone === '단호하게'
      ? ['말씀 주신 금액으로는 어렵습니다. 이 가격으로만 판매할게요.', '죄송하지만 추가 할인은 어렵습니다. 괜찮으시면 거래 진행하겠습니다.', '현재 가격이 최종이라 조정은 힘들 것 같아요.']
      : ['문의 주셔서 감사합니다. 현재 가격으로 거래 가능해요.', '네, 확인했습니다. 일정 맞으면 바로 거래 진행할게요.', '관심 가져주셔서 감사해요. 가능한 시간 알려주세요.']
  }

  if (intent === 'thanks') {
    return isOffice
      ? ['별말씀을요. 도움이 되었다니 다행입니다.', '네, 확인해주셔서 감사합니다. 필요한 점 있으면 말씀 주세요.', '저도 감사합니다. 남은 일정도 잘 부탁드립니다.']
      : ['별말씀을요! 도움이 됐다니 다행이다 😄', '나야말로 고마워!', '언제든지 말해줘.']
  }

  if (intent === 'invite') {
    return tone === '거절' || tone === '단호하게'
      ? ['이번에는 어려울 것 같아. 다음에 보자!', '이번 약속은 못 갈 것 같아. 미안해.', '이번에는 사양할게. 다음 기회에 함께하자.']
      : [isOffice ? '좋습니다. 일정 확인 후 다시 말씀드리겠습니다.' : '좋아! 일정 맞춰보고 알려줄게 😄', isOffice ? '네, 참석 가능합니다. 시간과 장소를 알려주세요.' : '좋지! 언제가 편해?', '초대해주셔서 고마워요. 함께할게요!']
  }

  if (intent === 'question') return [pool[0], isOffice ? '내용 확인 후 정확하게 답변드리겠습니다.' : '잠깐만, 확인해서 알려줄게!', isOffice ? '제가 확인할 부분을 먼저 살펴보고 말씀드리겠습니다.' : '이건 조금 더 알아보고 답해줄게.']
  if (intent === 'refusal' || tone === '거절') return isOffice
    ? ['이번 요청은 일정상 진행이 어려울 것 같습니다. 양해 부탁드립니다.', '죄송하지만 이번에는 함께하기 어려울 것 같습니다.', '이번 건은 어렵지만, 다음 기회에는 꼭 검토해보겠습니다.']
    : ['이번에는 어려울 것 같아. 미안해!', '이번에는 패스할게. 다음에 보자.', '고마워서 더 고민해봤는데, 이번에는 힘들 것 같아.']

  return [pool[0], pool[1], pool[2]]
}

export function generateReplies(message: string, relation: Relation, tone: Tone): Reply[] {
  const clean = sanitizeMessage(message)
  const texts = uniqueReplies(makeByIntent(clean, relation, tone))
  const labels = ['가장 무난', '조금 더 자연스럽게', '짧고 깔끔하게']
  const reasons = ['상대와 상황을 두루 고려한 표현이에요.', '부담 없이 대화를 이어가기 좋아요.', '핵심만 남겨 바로 보내기 편해요.']
  return texts.map((text, index) => ({
    id: `reply-${Date.now()}-${index}-${Math.random().toString(36).slice(2, 6)}`,
    text,
    label: labels[index] ?? '다른 표현',
    reason: reasons[index] ?? '상황에 맞게 다듬은 표현이에요.',
  }))
}
