// التحقّق من رمز OTP — Supabase Edge Function (Deno)
//
// يقارن تجزئة الرمز المُدخل بالمخزّنة، يتحقّق من الانتهاء وعدد المحاولات (≤5).
// عند النجاح يحذف السجلّ ويعيد {ok:true}. لا يكشف الرمز أبداً.
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const PEPPER = Deno.env.get('OTP_PEPPER') ?? ''

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

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: CORS })
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)

  let phone = ''
  let code = ''
  try {
    const body = await req.json()
    phone = onlyDigits(String(body?.phone ?? ''))
    code = onlyDigits(String(body?.code ?? ''))
  } catch {
    return json({ error: 'bad request' }, 400)
  }
  if (phone.length < 9 || code.length !== 6) return json({ ok: false, error: 'مدخلات غير صالحة' })

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)
  const { data: row } = await supabase
    .from('otp_codes')
    .select('code_hash, expires_at, attempts')
    .eq('phone', phone)
    .maybeSingle()

  if (!row) return json({ ok: false, error: 'اطلب رمزاً جديداً' })
  if (new Date(row.expires_at).getTime() < Date.now()) {
    await supabase.from('otp_codes').delete().eq('phone', phone)
    return json({ ok: false, error: 'انتهت صلاحية الرمز — اطلب رمزاً جديداً' })
  }
  if ((row.attempts ?? 0) >= 5) {
    await supabase.from('otp_codes').delete().eq('phone', phone)
    return json({ ok: false, error: 'محاولات كثيرة — اطلب رمزاً جديداً' })
  }

  const hash = await sha256hex(`${phone}:${code}:${PEPPER}`)
  if (hash !== row.code_hash) {
    await supabase
      .from('otp_codes')
      .update({ attempts: (row.attempts ?? 0) + 1 })
      .eq('phone', phone)
    return json({ ok: false, error: 'الرمز غير صحيح' })
  }

  // نجح — احذف السجلّ (استخدام لمرّة واحدة).
  await supabase.from('otp_codes').delete().eq('phone', phone)
  return json({ ok: true })
})
