/**
 * تنبيهات محلية للسائق (بلا خادم) — تعمل ما دام التطبيق مفتوحاً/«متصل».
 * عند وصول طلب جديد عبر Realtime: إشعار منبثق + صوت + اهتزاز.
 * لا تحتاج VAPID ولا Edge Function ولا اشتراكات — ضغطة إذن واحدة تكفي.
 */

export const notificationsSupported =
  typeof window !== 'undefined' && 'Notification' in window

export function notificationsGranted(): boolean {
  return notificationsSupported && Notification.permission === 'granted'
}

/** يطلب إذن الإشعارات (مرة واحدة). يُرجع true إن مُنح. */
export async function enableNotifications(): Promise<boolean> {
  if (!notificationsSupported) return false
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
  const title = '🚗 طلب رحلة جديد'
  const options: NotificationOptions = {
    body: 'يوجد راكب قريب منك — افتح «قريب» للقبول',
    icon: '/icon-192.png',
    badge: '/icon-192.png',
    tag: 'qareeb-ride',
    dir: 'rtl',
    lang: 'ar',
  }
  if (notificationsGranted()) {
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
