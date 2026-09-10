import { useEffect, useMemo, useRef, useState } from 'react'
import { copyText, decodeSharedPoll, decodeSharedVote, getInitialShareQuery, getShareQuery, readClipboard, sharePoll, shareVote, trackEvent } from './lib/ait'
import type { SharedVote } from './lib/ait'
import { sanitizeMessage, validateMessage } from './lib/replyEngine'
import { requestReplies } from './lib/replyApi'
import { addHistory, buildHistorySet, clearLocalData, deleteHistory, formatDate, isFavorite, readFavorites, readHistory, readUsage, toggleFavorite, trackGeneration } from './lib/storage'
import type { Relation, Reply, ReplySet, Screen, Tone } from './types'
import { Icon } from './components/Icon'
import logoUrl from '../assets/ReplyPick-logo-dark.png'

const relations: Relation[] = ['직장', '친구', '연인', '가족', '중고거래', '기타']
const tones: Tone[] = ['공손하게', '친근하게', '짧게', '단호하게', '사과', '거절']

function App() {
  const [query, setQuery] = useState(() => getShareQuery())
  const sharedPoll = useMemo(() => decodeSharedPoll(query.get('data')), [query])
  const sharedVote = useMemo(() => decodeSharedVote(query.get('data')), [query])
  const [screen, setScreen] = useState<Screen>(sharedVote ? 'vote-result' : sharedPoll ? 'poll' : 'home')
  const [message, setMessage] = useState('')
  const [relation, setRelation] = useState<Relation>('직장')
  const [tone, setTone] = useState<Tone>('공손하게')
  const [result, setResult] = useState<ReplySet | null>(null)
  const [history, setHistory] = useState<ReplySet[]>(() => readHistory())
  const [favoriteVersion, setFavoriteVersion] = useState(0)
  const [toast, setToast] = useState('')
  const [isGenerating, setIsGenerating] = useState(false)

  useEffect(() => {
    let active = true
    void getInitialShareQuery().then((initialQuery) => {
      if (active && initialQuery.get('data') && !query.get('data')) setQuery(initialQuery)
    })
    return () => { active = false }
  }, [query])

  useEffect(() => {
    if (sharedVote) setScreen('vote-result')
    else if (sharedPoll) setScreen('poll')
  }, [sharedPoll, sharedVote])

  useEffect(() => {
    if (!toast) return
    const timer = window.setTimeout(() => setToast(''), 2200)
    return () => window.clearTimeout(timer)
  }, [toast])

  const showToast = (text: string) => setToast(text)

  const goHome = () => {
    setScreen('home')
    setResult(null)
    setQuery(new URLSearchParams())
    window.history.replaceState({}, '', window.location.pathname)
  }

  const handleGenerate = (regenerate = false) => {
    const clean = sanitizeMessage(message)
    const error = validateMessage(clean)
    if (error) {
      showToast(error)
      return
    }
    if (regenerate && readUsage().regenerated >= 5) {
      showToast('오늘 재생성 횟수를 모두 사용했어요. 내일 다시 시도해 주세요.')
      return
    }
    setIsGenerating(true)
    trackEvent('generate_click', { relation, tone, regenerate })
    window.setTimeout(async () => {
      try {
        const replies = await requestReplies(clean, relation, tone)
        const set = buildHistorySet(clean, relation, tone, replies)
        addHistory(set)
        setHistory(readHistory())
        setResult(set)
        setScreen('result')
        trackGeneration(regenerate)
        trackEvent('generate_success', { source: import.meta.env.VITE_REPLY_API_URL ? 'ai' : 'local-dev' })
      } catch {
        trackEvent('generate_failure', { source: 'ai' })
        showToast('AI 답장 연결에 실패했어요. 잠시 후 다시 시도해 주세요.')
      } finally {
        setIsGenerating(false)
      }
    }, 480)
  }

  const handlePaste = async () => {
    trackEvent('paste_click')
    const text = await readClipboard()
    if (text) {
      setMessage(sanitizeMessage(text))
      showToast('클립보드에서 가져왔어요.')
    } else {
      showToast('클립보드에 텍스트가 없어요.')
    }
  }

  const handleCopy = async (reply: Reply) => {
    const success = await copyText(reply.text)
    if (success) {
      trackEvent('reply_copy', { replyId: reply.id })
      showToast('답장을 복사했어요.')
    } else showToast('복사하지 못했어요. 다시 시도해 주세요.')
  }

  const handleShare = async () => {
    if (!result) return
    const success = await sharePoll(result.message ?? message, result.replies)
    if (success) {
      trackEvent('poll_share')
      showToast('친구에게 선택지를 보냈어요.')
    } else showToast('공유 링크를 복사했어요.')
  }

  const handleShareVote = async (question: string, reply: Reply, index = 0) => {
    const success = await shareVote(question, reply, index)
    if (success) trackEvent('poll_vote_share', { replyId: reply.id, selectedIndex: index })
    return success
  }

  const handleFavorite = (reply: Reply) => {
    const added = toggleFavorite(reply)
    setFavoriteVersion((value) => value + 1)
    showToast(added ? '즐겨찾기에 저장했어요.' : '즐겨찾기에서 뺐어요.')
  }

  const openHistoryItem = (set: ReplySet) => {
    setResult(set)
    setMessage(set.message ?? '')
    setRelation(set.relation)
    setTone(set.tone)
    setScreen('result')
  }

  return <div className="app-shell">
    <div className="app-frame">
      {screen === 'home' && <HomeScreen message={message} setMessage={setMessage} relation={relation} setRelation={setRelation} tone={tone} setTone={setTone} onPaste={handlePaste} onGenerate={() => handleGenerate(false)} isGenerating={isGenerating} />}
      {screen === 'result' && result && <ResultScreen result={result} onBack={goHome} onCopy={handleCopy} onFavorite={handleFavorite} onShare={handleShare} onRegenerate={() => handleGenerate(true)} favoriteVersion={favoriteVersion} showToast={showToast} />}
      {screen === 'history' && <HistoryScreen history={history} favorites={readFavorites()} onBack={goHome} onOpen={openHistoryItem} onDelete={(id) => { deleteHistory(id); setHistory(readHistory()); showToast('기록을 삭제했어요.') }} onFavorite={handleFavorite} favoriteVersion={favoriteVersion} />}
      {screen === 'settings' && <SettingsScreen onBack={goHome} onClear={() => { clearLocalData(); setHistory([]); setFavoriteVersion((v) => v + 1); showToast('기기에 저장된 기록을 모두 지웠어요.') }} />}
      {screen === 'poll' && sharedPoll && <PollScreenV2 question={sharedPoll.question} replies={sharedPoll.replies} onStart={goHome} onCopy={handleCopy} onShareVote={handleShareVote} />}
      {screen === 'vote-result' && sharedVote && <VoteResultScreen vote={sharedVote} onStart={goHome} onCopy={handleCopy} />}
      {screen !== 'result' && screen !== 'poll' && screen !== 'vote-result' && <BottomNav screen={screen} onHome={goHome} onHistory={() => setScreen('history')} onSettings={() => setScreen('settings')} />}
    </div>
    {toast && <div className="toast" role="status"><Icon name="check" size={17} />{toast}</div>}
  </div>
}

function Header({ children, onBack, action }: { children?: React.ReactNode; onBack?: () => void; action?: React.ReactNode }) {
  return <header className="topbar">
    {onBack ? <button className="icon-button" onClick={onBack} aria-label="뒤로가기"><Icon name="arrow-left" /></button> : <div className="brand-mark"><span className="brand-orb"><img src={logoUrl} alt="" /></span><span>답장픽</span></div>}
    <div className="topbar-title">{children}</div>
    <div className="topbar-action">{action}</div>
  </header>
}

function HomeScreen({ message, setMessage, relation, setRelation, tone, setTone, onPaste, onGenerate, isGenerating }: { message: string; setMessage: (value: string) => void; relation: Relation; setRelation: (value: Relation) => void; tone: Tone; setTone: (value: Tone) => void; onPaste: () => void; onGenerate: () => void; isGenerating: boolean }) {
  const canGenerate = message.trim().length >= 1
  return <main className="screen home-screen">
    <Header action={<button className="text-button top-help" onClick={() => window.alert('받은 메시지를 1자 이상 붙여넣고, 관계와 말투를 고르면 바로 보낼 답장 3개를 만들어요.')}>도움말</button>} />
    <section className="hero-section">
      <div className="eyebrow"><span className="live-dot" />10초 답장 도우미</div>
      <h1>뭐라고 답하지?<br /><em>10초면 끝나요.</em></h1>
      <p>받은 메시지를 붙여넣고<br />바로 보낼 답장 3개를 골라보세요.</p>
    </section>
    <section className="composer-card">
      <div className="section-label-row"><span className="section-label">받은 메시지</span><button className="paste-button" onClick={onPaste}><Icon name="copy" size={16} />붙여넣기</button></div>
      <textarea value={message} onChange={(event) => setMessage(event.target.value.slice(0, 3000))} placeholder="상대방이 보낸 메시지를 여기에 붙여넣어 주세요." maxLength={3000} aria-label="받은 메시지 입력" />
      <div className="textarea-footer"><span>{message.length.toLocaleString()} / 3,000</span><span><Icon name="info" size={14} />받은 메시지는 기록에 함께 저장돼요</span></div>
    </section>
    <section className="choice-section">
      <div className="section-label">상대는 누구인가요?</div>
      <div className="chip-grid relation-grid">{relations.map((item) => <button key={item} className={`choice-chip ${relation === item ? 'selected' : ''}`} onClick={() => setRelation(item)}>{item}{relation === item && <Icon name="check" size={15} strokeWidth={2.5} />}</button>)}</div>
    </section>
    <section className="choice-section tone-choice">
      <div className="section-label">어떤 말투로 답할까요?</div>
      <div className="chip-grid tone-grid">{tones.map((item) => <button key={item} className={`choice-chip ${tone === item ? 'selected' : ''}`} onClick={() => setTone(item)}>{item}{tone === item && <Icon name="check" size={15} strokeWidth={2.5} />}</button>)}</div>
    </section>
    <button className="primary-button generate-button" disabled={!canGenerate || isGenerating} onClick={onGenerate}>{isGenerating ? <><span className="button-spinner" />답장 만드는 중...</> : <><Icon name="spark" size={19} />답장 3개 만들기</>}</button>
    <div className="home-note"><Icon name="warning" size={15} />{import.meta.env.VITE_REPLY_API_URL ? 'AI가 만든 답장이에요. 보내기 전에 한 번 더 확인해 주세요.' : import.meta.env.DEV ? '현재 개발용 로컬 생성 모드예요. 운영에서는 AI API를 연결해 주세요.' : 'AI API 연결 설정이 필요해요.'}</div>
  </main>
}

function ResultScreen({ result, onBack, onCopy, onFavorite, onShare, onRegenerate, favoriteVersion, showToast }: { result: ReplySet; onBack: () => void; onCopy: (reply: Reply) => void; onFavorite: (reply: Reply) => void; onShare: () => void; onRegenerate: () => void; favoriteVersion: number; showToast: (text: string) => void }) {
  const [feedback, setFeedback] = useState<'good' | 'bad' | null>(null)
  return <main className="screen result-screen">
    <Header onBack={onBack} action={<button className="icon-button" onClick={() => showToast('답장을 보낼 앱에 붙여넣어 주세요.')} aria-label="더보기"><Icon name="more" /></button>}>답장 추천</Header>
    <section className="result-heading"><div className="result-kicker"><span className="result-check"><Icon name="check" size={14} strokeWidth={2.8} /></span>답장 준비 완료</div><h1>바로 보내기 좋은<br /><em>답장 3개</em>예요.</h1><div className="result-meta"><span>{result.relation}</span><i /> <span>{result.tone}</span></div></section>
    <section className="reply-list">{result.replies.map((reply, index) => <ReplyCard key={reply.id} reply={reply} index={index} onCopy={onCopy} onFavorite={onFavorite} favoriteVersion={favoriteVersion} recommended={index === 0} />)}</section>
    <div className="result-actions"><button className="share-button" onClick={onShare}><span className="share-icon"><Icon name="send" size={18} /></span><span><strong>친구에게 골라달라고 하기</strong><small>A/B/C 선택지를 공유해요</small></span><Icon name="arrow-right" size={18} /></button><button className="regenerate-button" onClick={onRegenerate}><Icon name="refresh" size={16} />다른 답장 3개 보기</button></div>
    <div className="safe-note"><Icon name="info" size={15} />받은 메시지와 답장 선택지를 최근 기록에 남겨요. 공유하면 친구에게도 보여요.</div>
    <div className="feedback-box"><span>이번 답장 추천은 어땠나요?</span><div><button className={feedback === 'good' ? 'selected' : ''} onClick={() => { setFeedback('good'); trackEvent('feedback_submit', { rating: 'good' }); showToast('피드백 고마워요!') }} aria-label="좋아요">👍</button><button className={feedback === 'bad' ? 'selected' : ''} onClick={() => { setFeedback('bad'); trackEvent('feedback_submit', { rating: 'bad' }); showToast('더 자연스러운 답장을 만들게요.') }} aria-label="별로예요">👎</button></div></div>
    <BannerAd />
  </main>
}

type TossRuntime = typeof import('@apps-in-toss/web-framework')

function BannerAd() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [ready, setReady] = useState(false)
  const [adGroupId, setAdGroupId] = useState<string | null>(null)
  const [tossRuntime, setTossRuntime] = useState<TossRuntime | null>(null)

  useEffect(() => {
    let active = true
    void import('./lib/ads')
      .then(async (ads) => {
        const initialized = await ads.initializeReplyPickAds()
        if (!active || !initialized) return
        const runtime = await import('@apps-in-toss/web-framework')
        if (active && runtime.TossAds.attachBanner.isSupported()) {
          setAdGroupId(ads.REPLY_PICK_AD_GROUP_ID)
          setTossRuntime(runtime)
          setReady(true)
        }
      })
      .catch(() => {
        if (active) setReady(false)
      })
    return () => { active = false }
  }, [])

  useEffect(() => {
    if (!ready || !adGroupId || !tossRuntime || !containerRef.current) return
    const { TossAds } = tossRuntime

    let attached: { destroy: () => void } | undefined
    try {
      attached = TossAds.attachBanner(adGroupId, containerRef.current, {
        theme: 'light',
        tone: 'grey',
        variant: 'card',
        callbacks: {
          onAdRendered: () => trackEvent('ad_rendered'),
          onAdViewable: () => trackEvent('ad_viewable'),
          onAdClicked: () => trackEvent('ad_clicked'),
          onNoFill: () => trackEvent('ad_no_fill'),
          onAdFailedToRender: () => trackEvent('ad_failed'),
        },
      })
    } catch {
      setReady(false)
    }

    return () => attached?.destroy()
  }, [ready, adGroupId, tossRuntime])

  if (!ready) return null
  return <section className="ad-section" aria-label="광고"><span className="ad-label">AD</span><div ref={containerRef} className="ad-slot" /></section>
}

function ReplyCard({ reply, index, onCopy, onFavorite, favoriteVersion, recommended }: { reply: Reply; index: number; onCopy: (reply: Reply) => void; onFavorite: (reply: Reply) => void; favoriteVersion: number; recommended: boolean }) {
  void favoriteVersion
  return <article className={`reply-card ${recommended ? 'recommended' : ''}`}><div className="reply-card-top"><div className="reply-label"><span className={`reply-letter letter-${index}`}>{String.fromCharCode(65 + index)}</span><div><strong>{reply.label}</strong>{recommended && <span className="recommend-badge">추천</span>}<small>{reply.reason}</small></div></div><button className={`favorite-button ${isFavorite(reply.id) ? 'active' : ''}`} onClick={() => onFavorite(reply)} aria-label="즐겨찾기"><Icon name="heart" size={20} /></button></div><p className="reply-text">{reply.text}</p><button className="copy-button" onClick={() => onCopy(reply)}><Icon name="copy" size={17} />이 답장 복사</button></article>
}

function HistoryScreen({ history, favorites, onBack, onOpen, onDelete, onFavorite, favoriteVersion }: { history: ReplySet[]; favorites: Reply[]; onBack: () => void; onOpen: (set: ReplySet) => void; onDelete: (id: string) => void; onFavorite: (reply: Reply) => void; favoriteVersion: number }) {
  void favoriteVersion
  const [tab, setTab] = useState<'recent' | 'favorite'>('recent')
  return <main className="screen history-screen"><Header onBack={onBack}>기록</Header><section className="page-heading"><span className="eyebrow">MY REPLIES</span><h1>나의 답장 기록</h1><p>받은 메시지와 답장 선택지를 함께 보관해요.</p></section><div className="tab-switch"><button className={tab === 'recent' ? 'active' : ''} onClick={() => setTab('recent')}><Icon name="clock" size={17} />최근 답장 <span>{history.length}</span></button><button className={tab === 'favorite' ? 'active' : ''} onClick={() => setTab('favorite')}><Icon name="heart" size={17} />즐겨찾기 <span>{favorites.length}</span></button></div>{tab === 'recent' ? <div className="history-list">{history.length ? history.map((set) => <button className="history-item" key={set.id} onClick={() => onOpen(set)}><div className="history-item-top"><span>{formatDate(set.createdAt)}</span><span>{set.relation} · {set.tone}</span><Icon name="arrow-right" size={17} /></div><p className="history-question">{set.message || '받은 메시지가 없는 이전 기록이에요.'}</p><p className="history-reply">{set.replies[0]?.text}</p><div className="history-dots"><span>A</span><span>B</span><span>C</span><button onClick={(event) => { event.stopPropagation(); onDelete(set.id) }} aria-label="기록 삭제"><Icon name="trash" size={15} /></button></div></button>) : <EmptyHistory text="아직 만든 답장이 없어요." />}</div> : <div className="favorite-list">{favorites.length ? favorites.map((reply) => <div className="favorite-item" key={reply.id}><span className="reply-letter letter-0">A</span><p>{reply.text}<small>{reply.reason}</small></p><button onClick={() => onFavorite(reply)} aria-label="즐겨찾기 해제"><Icon name="heart" size={19} /></button></div>) : <EmptyHistory text="마음에 드는 답장을 저장해 보세요." />}</div>}</main>
}

function EmptyHistory({ text }: { text: string }) {
  return <div className="empty-state"><span className="empty-icon"><Icon name="message" size={23} /></span><strong>{text}</strong><p>답장을 만들면 이곳에서 다시 볼 수 있어요.</p></div>
}

function SettingsScreen({ onBack, onClear }: { onBack: () => void; onClear: () => void }) {
  const [confirm, setConfirm] = useState(false)
  return <main className="screen settings-screen"><Header onBack={onBack}>설정</Header><section className="page-heading"><span className="eyebrow">REPLYPICK</span><h1>가볍게, 안전하게</h1><p>로그인 없이 이 기기에만 답장을 보관해요.</p></section><div className="settings-card"><div className="settings-row"><span className="settings-icon blue"><Icon name="warning" size={19} /></span><div><strong>개인정보 안내</strong><p>받은 메시지와 답장은 이 기기에만 기록돼요. 서버 로그에는 원문을 남기지 않는 구조예요.</p></div></div><div className="settings-row"><span className="settings-icon green"><Icon name="check" size={19} /></span><div><strong>자동 전송하지 않아요</strong><p>답장을 직접 확인하고 원하는 메신저에 붙여넣는 방식이에요.</p></div></div></div><section className="danger-section"><div className="section-label">데이터 관리</div>{confirm ? <div className="confirm-card"><strong>저장된 기록을 모두 지울까요?</strong><p>최근 답장과 즐겨찾기가 이 기기에서 삭제돼요.</p><div><button className="ghost-button" onClick={() => setConfirm(false)}>취소</button><button className="danger-button" onClick={() => { onClear(); setConfirm(false) }}>모두 지우기</button></div></div> : <button className="settings-action" onClick={() => setConfirm(true)}><span><Icon name="trash" size={18} />저장된 기록 모두 지우기</span><Icon name="arrow-right" size={17} /></button>}</section><div className="version-note">ReplyPick v0.1 · 앱인토스 비게임 미니앱</div></main>
}

function PollScreen({ question, replies, onStart, onCopy, onShareVote }: { question: string; replies: Reply[]; onStart: () => void; onCopy: (reply: Reply) => void; onShareVote: (question: string, reply: Reply) => Promise<boolean> }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [voted, setVoted] = useState(false)
  const [votes, setVotes] = useState([4, 2, 1])
  if (!replies.length) return <main className="screen poll-screen"><Header onBack={onStart}>친구의 답장픽</Header><div className="empty-state poll-empty"><span className="empty-icon"><Icon name="warning" size={23} /></span><strong>공유 링크가 만료되었어요.</strong><p>새 답장을 만들어 다시 공유해 주세요.</p><button className="primary-button" onClick={onStart}>나도 답장 골라보기</button></div></main>
  const vote = () => {
    if (selected === null) return
    setVotes((current) => current.map((value, index) => index === selected ? value + 1 : value))
    setVoted(true)
    trackEvent('poll_vote', { selectedIndex: selected })
    void onShareVote(question, replies[selected])
  }
  return <main className="screen poll-screen"><Header onBack={onStart}>친구의 답장픽</Header><section className="poll-heading"><div className="poll-avatar"><Icon name="message" size={22} /></div><span className="eyebrow">답장 선택 투표</span><h1>이 중 어떤 답장이<br /><em>가장 자연스러워?</em></h1><p>친구가 고르기 어려운 답장 3개를 보냈어요.</p></section><div className="poll-options">{replies.map((reply, index) => <button key={reply.id} className={`poll-option ${selected === index ? 'selected' : ''}`} onClick={() => !voted && setSelected(index)}><span className={`reply-letter letter-${index}`}>{String.fromCharCode(65 + index)}</span><span className="poll-copy"><strong>{reply.label}</strong><span>{reply.text}</span></span>{voted ? <span className="vote-count">{votes[index]}표</span> : selected === index ? <Icon name="check" size={19} /> : <span className="poll-radio" />}</button>)}</div>{voted ? <div className="voted-card"><Icon name="check" size={18} /><strong>선택을 보냈어요!</strong><p>가장 많은 표를 받은 답장에 한 표 추가했어요.</p>{replies.map((reply, index) => <button key={reply.id} className="voted-copy" onClick={() => onCopy(reply)}><span>{String.fromCharCode(65 + index)} · {reply.text}</span><Icon name="copy" size={15} /></button>)}</div> : <button className="primary-button poll-button" disabled={selected === null} onClick={vote}>이 답장이 제일 좋아요</button>}<button className="text-button poll-start" onClick={onStart}>나도 답장 골라보기 <Icon name="arrow-right" size={15} /></button></main>
}

function PollScreenV2({ question, replies, onStart, onCopy, onShareVote }: { question: string; replies: Reply[]; onStart: () => void; onCopy: (reply: Reply) => void; onShareVote: (question: string, reply: Reply, index: number) => Promise<boolean> }) {
  const [selected, setSelected] = useState<number | null>(null)
  const [voted, setVoted] = useState(false)
  const [isSending, setIsSending] = useState(false)
  const [shared, setShared] = useState(false)

  const submitVote = async () => {
    if (selected === null) return
    setVoted(true)
    setIsSending(true)
    const didShare = await onShareVote(question, replies[selected], selected)
    setShared(didShare)
    setIsSending(false)
  }

  return <main className="screen poll-screen">
    <Header onBack={onStart}>친구의 답장픽</Header>
    <section className="poll-question-card"><span className="question-label">친구가 받은 질문</span><p>{question}</p></section>
    <section className="poll-heading"><div className="poll-avatar"><Icon name="message" size={22} /></div><span className="eyebrow">답장 선택 투표</span><h1>이 중 어떤 답장이<br /><em>가장 자연스러워?</em></h1><p>질문을 보고 가장 마음에 드는 답장을 골라주세요.</p></section>
    <div className="poll-options">{replies.map((reply, index) => <button key={reply.id} className={`poll-option ${selected === index ? 'selected' : ''}`} onClick={() => !voted && setSelected(index)}><span className={`reply-letter letter-${index}`}>{String.fromCharCode(65 + index)}</span><span className="poll-copy"><strong>{reply.label}</strong><span>{reply.text}</span></span>{selected === index ? <Icon name="check" size={19} /> : <span className="poll-radio" />}</button>)}</div>
    {voted ? <div className="voted-card"><Icon name="check" size={18} /><strong>선택했어요!</strong><p>{isSending ? '선택 결과를 친구에게 공유하는 중이에요.' : shared ? '친구에게 선택 결과를 공유했어요.' : '선택 결과를 다시 공유할 수 있어요.'}</p><button className="vote-share-button" onClick={async () => { if (selected === null) return; setIsSending(true); setShared(await onShareVote(question, replies[selected], selected)); setIsSending(false) }} disabled={isSending}><Icon name="send" size={16} />{isSending ? '공유하는 중...' : '선택 결과 다시 공유하기'}</button><button className="voted-copy" onClick={() => selected !== null && onCopy(replies[selected])}><span>선택한 답장 · {selected !== null ? replies[selected].text : ''}</span><Icon name="copy" size={15} /></button></div> : <button className="primary-button poll-button" disabled={selected === null} onClick={submitVote}>이 답장이 제일 좋아요</button>}
    <button className="text-button poll-start" onClick={onStart}>나도 답장 골라보기 <Icon name="arrow-right" size={15} /></button>
  </main>
}

function VoteResultScreen({ vote, onStart, onCopy }: { vote: SharedVote; onStart: () => void; onCopy: (reply: Reply) => void }) {
  return <main className="screen poll-screen">
    <Header onBack={onStart}>친구의 투표 결과</Header>
    <section className="poll-heading"><div className="poll-avatar"><Icon name="check" size={22} /></div><span className="eyebrow">답장 선택 완료</span><h1>친구가 고른<br /><em>답장이 도착했어요.</em></h1><p>친구가 질문을 보고 가장 자연스럽다고 고른 답장이에요.</p></section>
    <section className="vote-result-question"><span className="question-label">질문</span><p>{vote.question}</p></section>
    <article className="vote-result-card"><div className="reply-card-top"><div className="reply-label"><span className={`reply-letter letter-${vote.index}`}>{String.fromCharCode(65 + vote.index)}</span><div><strong>친구의 선택</strong><small>이 답장으로 보내보세요.</small></div></div><Icon name="check" size={20} /></div><p className="reply-text">{vote.reply.text}</p><button className="copy-button" onClick={() => onCopy(vote.reply)}><Icon name="copy" size={17} />이 답장 복사</button></article>
    <button className="primary-button poll-button" onClick={onStart}>나도 답장 골라보기</button>
  </main>
}

function BottomNav({ screen, onHome, onHistory, onSettings }: { screen: Screen; onHome: () => void; onHistory: () => void; onSettings: () => void }) {
  return <nav className="bottom-nav"><button className={screen === 'home' ? 'active' : ''} onClick={onHome}><Icon name="home" size={20} /><span>홈</span></button><button className={screen === 'history' ? 'active' : ''} onClick={onHistory}><Icon name="clock" size={20} /><span>기록</span></button><button className={screen === 'settings' ? 'active' : ''} onClick={onSettings}><Icon name="settings" size={20} /><span>설정</span></button></nav>
}

export default App
