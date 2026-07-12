import { Capacitor } from '@capacitor/core'

/**
 * الدخول بالبصمة/التعرّف على الوجه عبر @capgo/capacitor-native-biometric.
 * البيانات تُحفظ بأمان في Android Keystore (لا تُخزَّن كلمة السر في JS).
 * كل الدوال آمنة على الويب (تعود بلا فعل) — تعمل فعلياً على الجهاز فقط.
 */

const SERVER = 'sd.qareeb.app'
const FLAG = 'qareeb_bio' // علامة محلية أن المستخدم فعّل الدخول بالبصمة

const isNative = Capacitor.isNativePlatform()

async function nb() {
  if (!isNative) return null
  const { NativeBiometric } = await import('@capgo/capacitor-native-biometric')
  return NativeBiometric
}

/** هل الجهاز يدعم البصمة/الوجه وهي مُهيّأة؟ */
export async function biometricAvailable(): Promise<boolean> {
  const N = await nb()
  if (!N) return false
  try {
    const r = await N.isAvailable()
    return Boolean(r.isAvailable)
  } catch {
    return false
  }
}

/** هل فعّل المستخدم الدخول بالبصمة (وحفظ بياناته) على هذا الجهاز؟ */
export async function biometricEnabled(): Promise<boolean> {
  if (localStorage.getItem(FLAG) !== '1') return false
  return biometricAvailable()
}

/** حفظ بيانات الدخول بعد أول دخول ناجح + تفعيل العلامة. */
export async function enableBiometric(phone: string, password: string): Promise<boolean> {
  const N = await nb()
  if (!N) return false
  try {
    await N.setCredentials({ username: phone, password, server: SERVER })
    localStorage.setItem(FLAG, '1')
    return true
  } catch {
    return false
  }
}

/** التحقّق بالبصمة ثم إرجاع البيانات المحفوظة للدخول. */
export async function biometricLogin(): Promise<{ phone: string; password: string } | null> {
  const N = await nb()
  if (!N) return null
  try {
    await N.verifyIdentity({
      reason: 'الدخول إلى قريب',
      title: 'الدخول بالبصمة',
      subtitle: 'ضع إصبعك أو انظر للكاميرا',
      description: '',
    })
    const c = await N.getCredentials({ server: SERVER })
    if (!c?.username || !c?.password) return null
    return { phone: c.username, password: c.password }
  } catch {
    return null // ألغى المستخدم أو فشل التحقّق
  }
}

/** إلغاء تفعيل الدخول بالبصمة وحذف البيانات المحفوظة. */
export async function disableBiometric(): Promise<void> {
  const N = await nb()
  localStorage.removeItem(FLAG)
  if (!N) return
  try {
    await N.deleteCredentials({ server: SERVER })
  } catch {
    /* لا حرج */
  }
}
