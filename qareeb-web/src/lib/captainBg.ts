import { registerPlugin, Capacitor } from '@capacitor/core'

/**
 * جسر الإضافة الأصلية «CaptainBg» (Android فقط):
 *  • start/stop  — خدمة أمامية تُبقي الكابتن متصلاً في الخلفية/الشاشة مقفلة.
 *  • notifyRide  — إشعار طلب جديد أصلي بصوت واهتزاز يظهر على شاشة القفل.
 *  • requestNotif — إذن الإشعارات (Android 13+).
 * كل الدوال آمنة على الويب (تعود بلا فعل).
 */
interface CaptainBgPlugin {
  start(): Promise<void>
  stop(): Promise<void>
  notifyRide(o: { title: string; body: string }): Promise<void>
  alertSound(): Promise<void>
  requestNotif(): Promise<void>
  requestLocation(): Promise<void>
}

const CaptainBg = registerPlugin<CaptainBgPlugin>('CaptainBg')
export const isAndroid = Capacitor.getPlatform() === 'android'

/** يبدأ الخدمة الأمامية ويطلب إذن الإشعارات (عند «متصل»). */
export async function startCaptainBg(): Promise<void> {
  if (!isAndroid) return
  try {
    await CaptainBg.requestNotif()
    await CaptainBg.start()
  } catch {
    /* لا يُعطّل الاتصال إن فشلت الخدمة */
  }
}

/** يوقف الخدمة الأمامية (عند «غير متصل»). */
export async function stopCaptainBg(): Promise<void> {
  if (!isAndroid) return
  try {
    await CaptainBg.stop()
  } catch {
    /* تجاهل */
  }
}

/** إشعار طلب جديد أصلي — يعيد true إن عُرض عبر المسار الأصلي. */
export async function notifyRideNative(title: string, body: string): Promise<boolean> {
  if (!isAndroid) return false
  try {
    await CaptainBg.notifyRide({ title, body })
    return true
  } catch {
    return false
  }
}

/** صوت واهتزاز مباشران أصلياً — تنبيه مضمون والتطبيق مفتوح (المقدّمة). */
export async function playAlertNative(): Promise<void> {
  if (!isAndroid) return
  try {
    await CaptainBg.alertSound()
  } catch {
    /* تجاهل — يبقى مسار الإشعار */
  }
}

/** طلب إذن الإشعارات صراحةً (زر الجرس). */
export async function requestNotifNative(): Promise<void> {
  if (!isAndroid) return
  try {
    await CaptainBg.requestNotif()
  } catch {
    /* تجاهل */
  }
}

/**
 * يطلب إذن الموقع وقت التشغيل — ضروري ليعمل navigator.geolocation داخل WebView
 * على أندرويد (تتبّع موقع السائق + تحديد الموقع الحالي). آمن على الويب.
 */
export async function ensureLocationPermission(): Promise<void> {
  if (!isAndroid) return
  try {
    await CaptainBg.requestLocation()
  } catch {
    /* تجاهل — يظلّ navigator.geolocation يطلب الإذن إن أمكن */
  }
}
