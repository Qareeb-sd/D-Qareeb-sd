// إرسال رمز تحقّق (OTP) عبر واتساب — Supabase Edge Function (Deno)
//
// يولّد رمزاً من 6 أرقام، يخزّن **تجزئته** فقط في otp_codes (بمفتاح service_role،
// فلا يصل العميل للرمز)، ثم يُرسله عبر WhatsApp Cloud API (Meta) كرسالة قالب
// «مصادقة» (authentication template). حدّ إرسال: مرّة كل 60 ثانية للرقم.
//
// أسرار مطلوبة (supabase secrets set ...):
//   WHATSAPP_TOKEN      — رمز وصول دائم من Meta (WhatsApp Cloud API)
//   WHATSAPP_PHONE_ID   — معرّف رقم المُرسِل (Phone Number ID)
//   WHATSAPP_TEMPLATE   — اسم قالب المصادقة المعتمد (افتراضي: otp)
//   WHATSAPP_LANG       — رمز لغة القالب (افتراضي: ar)
//   OTP_PEPPER          — سرّ إضافي للتجزئة (اختياري لكن يُنصح به)
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً.)
//
// وضع تطوير: يُعاد devCode في الرد **فقط** عند ضبط OTP_DEV_MODE=1 صراحةً (لا
// يُضبط في الإنتاج أبداً). لو غابت أسرار واتساب بلا وضع تطوير، نفشل مغلقاً بدل
// كشف الرمز — فلا يتحوّل خطأ إعدادٍ في الإنتاج إلى تسريب رمزٍ لأي رقم.

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const WA_TOKEN = Deno.env.get('WHATSAPP_TOKEN') ?? ''
const WA_PHONE_ID = Deno.env.get('WHATSAPP_PHONE_ID') ?? ''
const WA_TEMPLATE = Deno.env.get('WHATSAPP_TEMPLATE') ?? 'otp'
const WA_LANG = Deno.env.get('WHATSAPP_LANG') ?? 'ar'
const PEPPER = Deno.env.get('OTP_PEPPER') ?? ''
// وضع تطوير صريح: يُعيد الرمز في الرد. لا يُضبط في الإنتاج مطلقاً.
const DEV_MODE = (Deno.env.get('OTP_DEV_MODE') ?? '') === '1'

const CORS = {
  'access-control-allow-origin': '*',
  'access-control-allow-headers': 'authorization, x-client-info, apikey, content-type',
  'access-control-allow-methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS, 'content-type': 'application/json' },
  })

const onlyDigits = (s: string) => s.replace(/\D/g, '')

async function sha256hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(s))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

async function sendWhatsapp(to: string, code: string): Promise<{ ok: boolean; detail?: string }> {
  const url = `https://graph.facebook.com/v21.0/${WA_PHONE_ID}/messages`
  const payload = {
    messaging_product: 'whatsapp',
    to,
    type: 'template',
    template: {
      name: WA_TEMPLATE,
      language: { code: WA_LANG },
      components: [
        { type: 'body', parameters: [{ type: 'text', text: code }] },
        // زر «نسخ الرمز» لقوالب المصادقة — يمرّر نفس الرمز.
        { type: 'button', sub_type: 'url', index: 0, parameters: [{ type: 'text', text: code }] },
      ],
    },
  }
  try {
    const res = await fetch(url, {
      method: 'POST',
      headers: { Authorization: `Bearer ${WA_TOKEN}`, 'content-type': 'application/json' },
      body: JSON.stringify(payload),
    })
    if (res.ok) return { ok: true }
    const txt = await res.text()
    return { ok: false, detail: txt.slice(0, 300) }
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : String(e) }
  }
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let phone = ''
  try {
    const body = await req.json()
    phone = onlyDigits(String(body?.phone ?? ''))
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  if (phone.length < 9) return json({ error: 'رقم غير صالح' }, 400)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // حدّ الإرسال: مرّة كل 60 ثانية للرقم.
  const { data: existing } = await supabase
    .from('otp_codes')
    .select('last_sent_at')
    .eq('phone', phone)
    .maybeSingle()
  if (existing?.last_sent_at) {
    const elapsed = Date.now() - new Date(existing.last_sent_at).getTime()
    if (elapsed < 60_000) {
      return json({ error: 'انتظر قليلاً قبل إعادة الإرسال', retryInMs: 60_000 - elapsed }, 429)
    }
  }

  // رمز من 6 أرقام + تخزين تجزئته وانتهاء بعد 5 دقائق.
  const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1_000_000).padStart(6, '0')
  const code_hash = await sha256hex(`${phone}:${code}:${PEPPER}`)
  const expires_at = new Date(Date.now() + 5 * 60_000).toISOString()

  const { error: upErr } = await supabase
    .from('otp_codes')
    .upsert({ phone, code_hash, expires_at, attempts: 0, last_sent_at: new Date().toISOString() })
  if (upErr) return json({ error: 'تعذّر إنشاء الرمز' }, 500)

  // وضع تطوير صريح فقط: يُعاد الرمز ليكتمل التدفّق دون واتساب.
  if (DEV_MODE) {
    return json({ sent: true, dev: true, devCode: code })
  }
  // إنتاج بلا أسرار واتساب = خطأ إعداد: نفشل مغلقاً بدل كشف الرمز.
  if (!WA_TOKEN || !WA_PHONE_ID) {
    return json({ error: 'خدمة التحقّق غير متاحة حالياً' }, 500)
  }

  const wa = await sendWhatsapp(phone, code)
  if (!wa.ok) return json({ error: 'فشل إرسال واتساب', detail: wa.detail }, 502)
  return json({ sent: true })
})
