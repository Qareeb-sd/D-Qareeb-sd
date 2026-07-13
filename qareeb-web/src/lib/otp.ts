import { supabase, isSupabaseConfigured } from './supabase'

/**
 * التحقّق عبر واتساب (OTP) — واجهة العميل لدالتَي Edge:
 *   send-otp   → يولّد الرمز ويرسله عبر WhatsApp Cloud API.
 *   verify-otp → يتحقّق من الرمز.
 * في وضع المعاينة (بلا Supabase) نستخدم رمزاً ثابتاً «000000» لتجربة التدفّق.
 */

export interface SendResult {
  ok: boolean
  /** يظهر فقط في وضع التطوير (بلا أسرار واتساب) لتسهيل الاختبار. */
  devCode?: string
  error?: string
}

export async function sendOtp(phone: string): Promise<SendResult> {
  if (!isSupabaseConfigured) return { ok: true, devCode: '000000' }
  const { data, error } = await supabase.functions.invoke('send-otp', { body: { phone } })
  if (error) {
    // نحاول قراءة رسالة الخطأ من جسم الرد (429/400/502…).
    let msg = 'تعذّر إرسال الرمز'
    try {
      const ctx = (error as { context?: Response }).context
      if (ctx) {
        const body = await ctx.json()
        if (body?.error) msg = body.error
      }
    } catch {
      /* تجاهل */
    }
    return { ok: false, error: msg }
  }
  return { ok: true, devCode: data?.devCode }
}

export async function verifyOtp(phone: string, code: string): Promise<{ ok: boolean; error?: string }> {
  if (!isSupabaseConfigured) return { ok: code === '000000' }
  const { data, error } = await supabase.functions.invoke('verify-otp', { body: { phone, code } })
  if (error) return { ok: false, error: 'تعذّر التحقّق من الرمز' }
  return { ok: Boolean(data?.ok), error: data?.error }
}
