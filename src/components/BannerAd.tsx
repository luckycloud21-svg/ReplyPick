import { useEffect, useRef, useState } from 'react'
import { TossAds } from '@apps-in-toss/web-framework'
import { initializeReplyPickAds, REPLY_PICK_AD_GROUP_ID } from '../lib/ads'
import { trackEvent } from '../lib/ait'

type AdStatus = 'loading' | 'rendered' | 'unavailable'

export function BannerAd() {
  const containerRef = useRef<HTMLDivElement>(null)
  const [status, setStatus] = useState<AdStatus>('loading')

  useEffect(() => {
    let active = true
    let slotEnded = false
    let attached: { destroy: () => void } | undefined
    let renderTimer: number | undefined
    const unavailable = (event: string, detail?: unknown) => {
      if (!active) return
      slotEnded = true
      window.clearTimeout(renderTimer)
      console.warn(`[ReplyPick] ${event}`, detail ?? '')
      trackEvent(event)
      setStatus('unavailable')
      attached?.destroy()
      attached = undefined
    }

    void (async () => {
      try {
        const initialized = await initializeReplyPickAds()
        if (!active) return
        if (!initialized || !TossAds.attachBanner.isSupported()) {
          unavailable('ad_unavailable')
          return
        }
        const target = containerRef.current
        if (!target) return
        renderTimer = window.setTimeout(() => unavailable('ad_render_timeout'), 15000)
        let failedDuringAttach = false
        const fail = (event: string, detail?: unknown) => {
          failedDuringAttach = true
          unavailable(event, detail)
        }
        attached = TossAds.attachBanner(REPLY_PICK_AD_GROUP_ID, target, {
          theme: 'light',
          tone: 'grey',
          variant: 'card',
          callbacks: {
            onAdRendered: () => {
              if (!active || slotEnded) return
              window.clearTimeout(renderTimer)
              setStatus('rendered')
              trackEvent('ad_rendered')
            },
            onAdImpression: () => trackEvent('ad_impression'),
            onAdViewable: () => trackEvent('ad_viewable'),
            onAdClicked: () => trackEvent('ad_clicked'),
            onNoFill: (payload) => fail('ad_no_fill', payload),
            onAdFailedToRender: (payload) => fail('ad_failed', payload.error),
          },
        })
        // The SDK can report a failure synchronously before returning the slot.
        if (failedDuringAttach) {
          attached?.destroy()
          attached = undefined
        }
      } catch (error) {
        unavailable('ad_failed', error)
      }
    })()

    return () => {
      active = false
      window.clearTimeout(renderTimer)
      attached?.destroy()
    }
  }, [])

  if (status === 'unavailable') return null
  return <section className="ad-section" aria-label="광고" aria-busy={status === 'loading'}>
    <span className="ad-label">AD · 광고</span>
    <div className="ad-content">
      {/* Keep the SDK target empty and let the image determine its height. */}
      <div ref={containerRef} className="ad-slot" />
      {status === 'loading' && <div className="ad-loading" role="status">광고를 불러오는 중이에요</div>}
    </div>
  </section>
}
