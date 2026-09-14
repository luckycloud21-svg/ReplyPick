import { TossAds } from '@apps-in-toss/web-framework'

export const LIVE_AD_GROUP_ID = 'ait.v2.live.8e3c328ace9c4748'
export const REPLY_PICK_AD_GROUP_ID = import.meta.env.DEV || import.meta.env.VITE_AD_TEST_MODE === 'true'
  ? 'ait-ad-test-native-image-id'
  : LIVE_AD_GROUP_ID

let initialization: Promise<boolean> | null = null

export function initializeReplyPickAds(): Promise<boolean> {
  if (initialization) return initialization

  try {
    // A host that is not ready yet must not disable ads for the entire session.
    if (!TossAds.initialize.isSupported()) return Promise.resolve(false)
  } catch (error) {
    console.warn('[ReplyPick] Ads support check failed', error)
    return Promise.resolve(false)
  }

  initialization = new Promise<boolean>((resolve) => {
    const timer = window.setTimeout(() => {
      console.warn('[ReplyPick] Ads initialization timed out')
      resolve(false)
    }, 10000)
    const finish = (success: boolean) => {
      window.clearTimeout(timer)
      resolve(success)
    }
    try {
      TossAds.initialize({
        callbacks: {
          onInitialized: () => finish(true),
          onInitializationFailed: (error) => {
            console.warn('[ReplyPick] Ads initialization failed', error)
            finish(false)
          },
        },
      })
    } catch (error) {
      console.warn('[ReplyPick] Ads are unavailable', error)
      finish(false)
    }
  }).then((success) => {
    // Retry only on a later screen entry, never repeatedly refresh a live ad.
    if (!success) initialization = null
    return success
  })

  return initialization
}
