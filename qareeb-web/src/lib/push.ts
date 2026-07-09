import { savePushSubscription, deletePushSubscription } from './api'
import { isSupabaseConfigured } from './supabase'

/**
 * إشعارات Web Push (خلفية) — تسجيل Service Worker والاشتراك/إلغاء الاشتراك.
 * يتطلّب مفتاح VAPID العام في VITE_VAPID_PUBLIC_KEY ودالة Edge للإرسال
 * (انظر supabase/functions/push و PUSH.md).
 */

const VAPID_PUBLIC = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined

export type PushState = 'unsupported' | 'unconfigured' | 'default' | 'granted' | 'denied'

/** هل يدعم المتصفح الإشعارات الخلفية؟ */
export function pushSupported(): boolean {
  return (
    typeof navigator !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

/** حالة الإشعارات الحالية (لعرض زر التفعيل المناسب). */
export function pushState(): PushState {
  if (!pushSupported()) return 'unsupported'
  if (!VAPID_PUBLIC || !isSupabaseConfigured) return 'unconfigured'
  return Notification.permission as 'default' | 'granted' | 'denied'
}

/** يسجّل الـ Service Worker (يُستدعى مرّة عند إقلاع التطبيق). */
export async function registerServiceWorker(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  try {
    await navigator.serviceWorker.register('/sw.js')
  } catch {
    /* تجاهل — الإشعارات اختيارية */
  }
}

function urlBase64ToUint8Array(base64: string): Uint8Array<ArrayBuffer> {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const b64 = (base64 + padding).replace(/-/g, '+').replace(/_/g, '/')
  const raw = atob(b64)
  const arr = new Uint8Array(new ArrayBuffer(raw.length))
  for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i)
  return arr
}

/** يطلب الإذن ويشترك في الإشعارات ويحفظ الاشتراك في القاعدة. */
export async function enablePush(userId: string): Promise<{ ok: boolean; error?: string }> {
  if (!pushSupported()) return { ok: false, error: 'المتصفح لا يدعم الإشعارات' }
  if (!VAPID_PUBLIC || !isSupabaseConfigured) return { ok: false, error: 'الإشعارات غير مهيّأة بعد' }

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return { ok: false, error: 'لم يُسمح بالإشعارات' }

  try {
    const reg = await navigator.serviceWorker.ready
    const existing = await reg.pushManager.getSubscription()
    const sub =
      existing ??
      (await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC),
      }))
    await savePushSubscription(userId, sub.toJSON())
    return { ok: true }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'تعذّر تفعيل الإشعارات' }
  }
}

/** يلغي الاشتراك ويزيله من القاعدة. */
export async function disablePush(): Promise<void> {
  if (!pushSupported()) return
  const reg = await navigator.serviceWorker.ready
  const sub = await reg.pushManager.getSubscription()
  if (sub) {
    await deletePushSubscription(sub.endpoint)
    await sub.unsubscribe()
  }
}
