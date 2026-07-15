import { Capacitor } from '@capacitor/core'
import { saveDeviceToken, deleteDeviceToken } from './api'
import { supabase, isSupabaseConfigured } from './supabase'

/**
 * إشعارات FCM الأصلية للكابتن — تصله والتطبيق في الخلفية أو الشاشة مقفلة.
 * يعمل فقط على أندرويد الأصلي (Capacitor) ومع وجود google-services.json وإعداد FCM.
 * كل الدوال تتحمّل غياب الدعم بهدوء (لا تكسر الويب/المعاينة).
 */

const isNative = Capacitor.getPlatform() === 'android'

let currentToken: string | null = null

// حالة تشخيصية مرئية (لمعرفة أين يفشل تسجيل الإشعارات دون سجلّ الهاتف).
const STATUS_KEY = 'qareeb_fcm_status'
function setStatus(s: string): void {
  try {
    localStorage.setItem(STATUS_KEY, s)
  } catch {
    /* تجاهل */
  }
}
export function getPushStatus(): string {
  try {
    return localStorage.getItem(STATUS_KEY) || 'لم يبدأ'
  } catch {
    return 'غير متاح'
  }
}

// استيراد ديناميكي حتى لا يُحمَّل الملحق على الويب.
async function plugin() {
  const mod = await import('@capacitor/push-notifications')
  return mod.PushNotifications
}

/**
 * يطلب الإذن، يسجّل الجهاز في FCM، ويحفظ الرمز لهذا المستخدم. يُستدعى عند فتح
 * التطبيق (عميل/سائق) ليبقى الرمز محفوظاً فتصله إشعارات الاعتماد وغيرها، وعند
 * اتصال الكابتن ليصله إشعار الطلبات. آمن للاستدعاء المتكرّر (idempotent).
 */
export async function registerPush(userId: string): Promise<boolean> {
  return registerPushForDriver(userId)
}

/**
 * يهيّئ الإشعارات عند فتح التطبيق: يطلب الإذن، ويسجّل الرمز مباشرةً بقراءة معرّف
 * المستخدم من جلسة Supabase (بلا اعتماد على حالة React) — أكثر موثوقية. يُعيد
 * التسجيل عند تغيّر الجلسة (دخول/خروج).
 */
export async function ensurePushPermission(): Promise<void> {
  if (!isNative) {
    setStatus('ليس أندرويد')
    return
  }
  const tryRegister = async () => {
    if (!isSupabaseConfigured) {
      setStatus('Supabase غير مضبوط')
      return
    }
    setStatus('يقرأ الجلسة…')
    const { data } = await supabase.auth.getSession()
    const uid = data.session?.user?.id
    if (!uid) {
      setStatus('لا جلسة بعد — بانتظار الدخول')
      return
    }
    await registerPushForDriver(uid)
  }
  await tryRegister()
  // أعِد المحاولة عند تغيّر الجلسة (بعد تسجيل الدخول مثلاً).
  if (isSupabaseConfigured) {
    supabase.auth.onAuthStateChange(() => {
      void tryRegister()
    })
  }
}

export async function registerPushForDriver(userId: string): Promise<boolean> {
  if (!isNative) {
    setStatus('ليس أندرويد')
    return false
  }
  if (!userId) {
    setStatus('لا مستخدم')
    return false
  }
  try {
    setStatus('تحميل ملحق الإشعارات…')
    const PushNotifications = await plugin()
    setStatus('فحص الإذن…')
    const perm = await PushNotifications.checkPermissions()
    let status = perm.receive
    if (status === 'prompt' || status === 'prompt-with-rationale') {
      status = (await PushNotifications.requestPermissions()).receive
    }
    if (status !== 'granted') {
      setStatus(`الإذن: ${status}`)
      return false
    }
    setStatus('الإذن ممنوح — جارٍ التسجيل…')

    // مستمعو الأحداث — نُنتظرهم قبل register() حتى لا يُطلق الرمز قبل جهوز
    // المستمع فيضيع (سبب بقاء device_tokens فارغاً).
    await PushNotifications.removeAllListeners()
    await PushNotifications.addListener('registration', (t: { value: string }) => {
      currentToken = t.value
      setStatus(`رمز مستلَم ✓ (${t.value.slice(0, 10)}…) — جارٍ الحفظ`)
      void saveDeviceToken(userId, t.value)
        .then(() => setStatus(`محفوظ ✓ (${t.value.slice(0, 10)}…)`))
        .catch((e) => setStatus(`فشل الحفظ: ${String(e).slice(0, 60)}`))
    })
    await PushNotifications.addListener('registrationError', (e: unknown) => {
      setStatus(`خطأ تسجيل FCM: ${JSON.stringify(e).slice(0, 80)}`)
    })

    await PushNotifications.register()
    return true
  } catch (e) {
    setStatus(`استثناء: ${String(e).slice(0, 80)}`)
    return false
  }
}

/** يلغي تسجيل رمز هذا الجهاز (عند «غير متصل» أو تسجيل الخروج). */
export async function unregisterPush(): Promise<void> {
  if (!isNative) return
  try {
    if (currentToken) {
      await deleteDeviceToken(currentToken)
      currentToken = null
    }
    const PushNotifications = await plugin()
    await PushNotifications.removeAllListeners()
  } catch {
    /* تجاهل */
  }
}
