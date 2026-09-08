export type Relation = '직장' | '친구' | '연인' | '가족' | '중고거래' | '기타'
export type Tone = '공손하게' | '친근하게' | '짧게' | '단호하게' | '사과' | '거절'

export type Reply = {
  id: string
  text: string
  label: string
  reason: string
}

export type ReplySet = {
  id: string
  createdAt: number
  relation: Relation
  tone: Tone
  replies: Reply[]
}

export type Screen = 'home' | 'result' | 'history' | 'settings' | 'poll'
