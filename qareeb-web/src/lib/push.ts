import { savePushSubscription, deletePushSubscription } from './api'
import { isSupabaseConfigured } from './supabase'

/**
 * اشتراك إشعارات Web Push (أصلي — بلا طرف ثالث).
 * يعمل فقط إذا ضُبط مفتاح VAPID العام ودعم المتصفح الـ Push.
 * كل الدوال تتحمّل غياب الدعم/الإعداد بهدوء (لا تكسر التطبيق).
 */

export const VAPID_PUBLIC_KEY = (import.meta.env.VITE_VAPID_PUBLIC_KEY as string) ?? ''

export const isPushConfigured =
  Boolean(VAPID_PUBLIC_KEY) &&
  typeof window !== 'undefined' &&
  'serviceWorker' in navigator &&
  'PushManager' in window &&
  'Notification' in window

export type PushPermission = 'unsupported' | 'default' | 'denied' | 'granted'

export function pushPermission(): PushPermission {
  if (!isPushConfigured) return 'unsupported'
  return Notification.permission as PushPermission
}

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(base64)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function registration(): Promise<ServiceWorkerRegistration | null> {
  if (!('serviceWorker' in navigator)) return null
  return navigator.serviceWorker.ready
}

/** هل المستخدم مشترك فعلاً في هذا الجهاز؟ */
export async function isPushEnabled(): Promise<boolean> {
  if (!isPushConfigured) return false
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  return Boolean(sub)
}

/** يطلب الإذن ويشترك ويحفظ الاشتراك في Supabase. يُرجع خطأً واضحاً عند الفشل. */
export async function enablePush(userId: string): Promise<{ error?: string }> {
  if (!isPushConfigured) return { error: 'الإشعارات غير مهيّأة على هذا الجهاز' }
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') return { error: 'لم يتم السماح بالإشعارات' }

    const reg = await navigator.serviceWorker.ready
    let sub = await reg.pushManager.getSubscription()
    if (!sub) {
      sub = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
      })
    }

    await persist(sub, userId)
    // نتذكّر المفتاح الذي اشتركنا به لكشف تدوير المفاتيح لاحقاً.
    try {
      localStorage.setItem(KEY_TAG, VAPID_PUBLIC_KEY)
    } catch {
      /* تجاهل */
    }
    return {}
  } catch (e) {
    return { error: (e as Error).message }
  }
}

const KEY_TAG = 'qareeb_push_key'

async function persist(sub: PushSubscription, userId: string): Promise<void> {
  const json = sub.toJSON()
  if (isSupabaseConfigured && json.keys?.p256dh && json.keys?.auth) {
    await savePushSubscription({
      user_id: userId,
      endpoint: sub.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    })
  }
}

/**
 * يعالج تدوير مفاتيح VAPID: إن كان الجهاز مشتركاً بمفتاحٍ قديم يختلف عن الحالي،
 * فاشتراكه ميت (الخادم يوقّع بالمفتاح الجديد). نُعيد الاشتراك تلقائياً وبصمت.
 * لا يطلب إذناً ولا يُنشئ اشتراكاً جديداً لمن لم يشترك أصلاً — آمن للاستدعاء دائماً.
 */
export async function refreshPushSubscription(userId: string): Promise<void> {
  if (!isPushConfigured) return
  try {
    const reg = await navigator.serviceWorker.ready
    const sub = await reg.pushManager.getSubscription()
    if (!sub) return // غير مشترك — لا شيء نصلحه

    let tagged: string | null = null
    try {
      tagged = localStorage.getItem(KEY_TAG)
    } catch {
      /* تجاهل */
    }
    if (tagged === VAPID_PUBLIC_KEY) return // المفتاح لم يتغيّر

    // المفتاح تغيّر (أو غير معروف) → أعد الاشتراك بالمفتاح الحالي.
    await deletePushSubscription(sub.endpoint).catch(() => {})
    await sub.unsubscribe().catch(() => {})
    const fresh = await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY) as BufferSource,
    })
    await persist(fresh, userId)
    try {
      localStorage.setItem(KEY_TAG, VAPID_PUBLIC_KEY)
    } catch {
      /* تجاهل */
    }
  } catch {
    /* عطل مؤقّت — نُعيد المحاولة عند الفتح القادم */
  }
}

/** يلغي الاشتراك على هذا الجهاز ويحذفه من Supabase. */
export async function disablePush(): Promise<void> {
  const reg = await registration()
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await deletePushSubscription(sub.endpoint)
  await sub.unsubscribe().catch(() => {})
}
