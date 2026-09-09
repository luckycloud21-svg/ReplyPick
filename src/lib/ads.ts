import { TossAds } from '@apps-in-toss/web-framework'

export const LIVE_AD_GROUP_ID = 'ait.v2.live.8e3c328ace9c4748'
export const REPLY_PICK_AD_GROUP_ID = LIVE_AD_GROUP_ID

let initialization: Promise<boolean> | null = null

export function initializeReplyPickAds(): Promise<boolean> {
  if (initialization) return initialization

  if (!TossAds.initialize.isSupported()) {
    initialization = Promise.resolve(false)
    return initialization
  }

  initialization = new Promise((resolve) => {
    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => resolve(true),
          onInitializationFailed: (error) => {
            console.warn('[ReplyPick] Ads initialization failed', error)
            resolve(false)
          },
        },
      })
    } catch (error) {
      console.warn('[ReplyPick] Ads are unavailable', error)
      resolve(false)
    }
  })

  return initialization
}
