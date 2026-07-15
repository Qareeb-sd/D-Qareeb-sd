import { Capacitor } from '@capacitor/core'
import type { BiometricAuthPlugin } from '@aparajita/capacitor-biometric-auth'

/**
 * الدخول بالبصمة/الوجه عبر @aparajita/capacitor-biometric-auth (متوافق مع
 * Capacitor 8 ومستقرّ). المكوّن يوفّر بصمة/تحقّقاً فقط، فنحفظ بيانات الدخول
 * محلياً على الجهاز (مُرمّزة base64) ويحرسها التحقّق البيومتري.
 * كل الدوال آمنة على الويب (تعود بلا فعل) — تعمل فعلياً على الجهاز فقط.
 */

const FLAG = 'qareeb_bio' // علامة أن المستخدم فعّل البصمة
const CRED = 'qareeb_bio_cred' // بيانات الدخول المُرمّزة
const isNative = Capacitor.isNativePlatform()

// نُغلّف الوسيط (proxy) في كائن عادي: إرجاعه مباشرةً من دالة async يجعل JS
// يعامله كأنه Promise (يستدعي .then عليه) فيفشل بـ "then() not implemented".
async function ba(): Promise<{ B: BiometricAuthPlugin } | null> {
  if (!isNative) return null
  const mod = await import('@aparajita/capacitor-biometric-auth')
  return { B: mod.BiometricAuth }
}

function encode(o: { phone: string; password: string }): string {
  return btoa(unescape(encodeURIComponent(JSON.stringify(o))))
}
function decode(s: string): { phone: string; password: string } | null {
  try {
    return JSON.parse(decodeURIComponent(escape(atob(s))))
  } catch {
    return null
  }
}

/** هل الجهاز يدعم البصمة/الوجه وهي مُهيّأة؟ (checkBiometry لا يُظهر نافذة) */
export async function biometricAvailable(): Promise<boolean> {
  const lib = await ba()
  if (!lib) return false
  try {
    const r = await lib.B.checkBiometry()
    return Boolean(r.isAvailable)
  } catch {
    return false
  }
}

/** هل فعّل المستخدم الدخول بالبصمة على هذا الجهاز؟ (محلي — بلا نداء أصلي) */
export async function biometricEnabled(): Promise<boolean> {
  return localStorage.getItem(FLAG) === '1' && Boolean(localStorage.getItem(CRED))
}

/** تفعيل البصمة — يفحص التوفّر ويحفظ البيانات؛ يعيد نتيجة واضحة. */
export async function enableBiometric(
  phone: string,
  password: string,
): Promise<{ ok: boolean; reason?: string }> {
  const lib = await ba()
  if (!lib) return { ok: false, reason: 'متاح على الجهاز فقط' }
  try {
    const r = await lib.B.checkBiometry()
    if (!r.isAvailable) {
      return {
        ok: false,
        reason:
          r.reason || 'لا توجد بصمة/وجه مُسجّل على الجهاز — أضِفه من إعدادات الهاتف ثم أعد المحاولة.',
      }
    }
    localStorage.setItem(CRED, encode({ phone, password }))
    localStorage.setItem(FLAG, '1')
    return { ok: true }
  } catch (e) {
    return { ok: false, reason: (e as Error)?.message || 'تعذّر تفعيل البصمة' }
  }
}

/** التحقّق بالبصمة ثم إرجاع بيانات الدخول المحفوظة. */
export async function biometricLogin(): Promise<{ phone: string; password: string } | null> {
  const lib = await ba()
  if (!lib) return null
  const cred = localStorage.getItem(CRED)
  if (!cred) return null
  try {
    await lib.B.authenticate({
      reason: 'الدخول إلى قريب',
      androidTitle: 'الدخول بالبصمة',
      androidSubtitle: 'أكّد هويتك للمتابعة',
      cancelTitle: 'إلغاء',
      allowDeviceCredential: true,
    })
    return decode(cred)
  } catch {
    return null // ألغى المستخدم أو فشل التحقّق
  }
}

/** إلغاء تفعيل الدخول بالبصمة وحذف البيانات المحفوظة. */
export async function disableBiometric(): Promise<void> {
  localStorage.removeItem(FLAG)
  localStorage.removeItem(CRED)
}
