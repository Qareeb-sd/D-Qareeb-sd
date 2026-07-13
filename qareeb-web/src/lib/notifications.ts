/**
 * تنبيهات السائق بطلب جديد: إشعار + صوت + اهتزاز.
 *  • على أندرويد: مسار أصلي (إضافة CaptainBg) يعمل في الخلفية/الشاشة مقفلة.
 *  • على الويب: Notification API + WebAudio + اهتزاز (أثناء فتح التطبيق فقط).
 */
import { isAndroid, notifyRideNative, requestNotifNative } from './captainBg'

export const notificationsSupported =
  isAndroid || (typeof window !== 'undefined' && 'Notification' in window)

export function notificationsGranted(): boolean {
  if (isAndroid) return true // يُدار الإذن أصلياً عند الاتصال
  return typeof Notification !== 'undefined' && Notification.permission === 'granted'
}

/** يطلب إذن الإشعارات (مرة واحدة). يُرجع true إن مُنح. */
export async function enableNotifications(): Promise<boolean> {
  if (isAndroid) {
    await requestNotifNative()
    return true
  }
  if (typeof Notification === 'undefined') return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  const result = await Notification.requestPermission()
  return result === 'granted'
}

// نغمة تنبيه قصيرة عبر WebAudio (بلا ملف صوت).
let audioCtx: AudioContext | null = null
function beep() {
  try {
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext
    audioCtx = audioCtx || new Ctx()
    void audioCtx.resume()
    const osc = audioCtx.createOscillator()
    const gain = audioCtx.createGain()
    osc.connect(gain)
    gain.connect(audioCtx.destination)
    osc.type = 'sine'
    osc.frequency.value = 880
    const t = audioCtx.currentTime
    gain.gain.setValueAtTime(0.0001, t)
    gain.gain.exponentialRampToValueAtTime(0.35, t + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.45)
    osc.start(t)
    osc.stop(t + 0.47)
  } catch {
    /* الصوت اختياري */
  }
}

/** ينبّه السائق بطلب جديد: إشعار + صوت + اهتزاز. */
export async function alertNewRide(): Promise<void> {
  // على أندرويد: المسار الأصلي (صوت + اهتزاز + شاشة القفل + الخلفية).
  await notify('طلب رحلة جديد', 'يوجد راكب قريب منك — افتح «قريب» للقبول')
}

/** إشعار عام (صوت + اهتزاز) — يُستخدم أيضاً لإخطار العميل بقبول رحلته. */
export async function notify(title: string, body: string): Promise<void> {
  if (isAndroid) {
    const shown = await notifyRideNative(title, body)
    if (shown) return
  }
  const options: NotificationOptions = {
    body,
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'qareeb-ride',
    dir: 'rtl',
    lang: 'ar',
  }
  if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
    try {
      // على الجوال يجب استخدام الـ Service Worker لعرض الإشعار.
      const reg =
        'serviceWorker' in navigator ? await navigator.serviceWorker.getRegistration() : null
      if (reg) await reg.showNotification(title, options)
      else new Notification(title, options)
    } catch {
      /* تجاهل — يبقى الصوت والاهتزاز */
    }
  }
  if ('vibrate' in navigator) navigator.vibrate([200, 100, 200])
  beep()
}
