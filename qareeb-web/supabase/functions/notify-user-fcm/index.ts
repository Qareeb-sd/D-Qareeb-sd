// إشعار مستخدم محدّد عبر FCM (HTTP v1) — Supabase Edge Function (Deno).
// يُرسل إشعاراً أصلياً لكل أجهزة مستخدم واحد (device_tokens). يُستخدم لإعلام
// العميل/السائق عند اعتماد التعبئة أو السحب.
//
// الجسم المقبول (أحدها):
//   { user_id, title, body, data? }   — إرسال مباشر
//   { topup_id }                      — يستنتج المستخدم والمبلغ ويصيغ الرسالة
//   { withdrawal_id }                 — كذلك للسحب
//
// أسرار مطلوبة (نفس notify-ride-fcm):
//   FCM_SERVICE_ACCOUNT  — محتوى ملف حساب خدمة Firebase (JSON كاملاً كسلسلة)
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const SERVICE_ACCOUNT_RAW = Deno.env.get('FCM_SERVICE_ACCOUNT') ?? ''
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

interface ServiceAccount {
  client_email: string
  private_key: string
  project_id: string
}

function b64url(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const strB64url = (s: string) => b64url(new TextEncoder().encode(s))

function pemToDer(pem: string): Uint8Array {
  const body = pem
    .replace(/-----BEGIN [^-]+-----/, '')
    .replace(/-----END [^-]+-----/, '')
    .replace(/\s+/g, '')
  const raw = atob(body)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}

async function accessToken(sa: ServiceAccount): Promise<string> {
  const now = Math.floor(Date.now() / 1000)
  const header = strB64url(JSON.stringify({ alg: 'RS256', typ: 'JWT' }))
  const claims = strB64url(
    JSON.stringify({
      iss: sa.client_email,
      scope: 'https://www.googleapis.com/auth/firebase.messaging',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    }),
  )
  const input = `${header}.${claims}`
  const key = await crypto.subtle.importKey(
    'pkcs8',
    pemToDer(sa.private_key) as BufferSource,
    { name: 'RSASSA-PKCS1-v1_5', hash: 'SHA-256' },
    false,
    ['sign'],
  )
  const sig = new Uint8Array(
    await crypto.subtle.sign('RSASSA-PKCS1-v1_5', key, new TextEncoder().encode(input)),
  )
  const jwt = `${input}.${b64url(sig)}`

  const res = await fetch('https://oauth2.googleapis.com/token', {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
      assertion: jwt,
    }),
  })
  const data = await res.json()
  if (!data.access_token) throw new Error(`token error: ${JSON.stringify(data)}`)
  return data.access_token as string
}

const fmt = (n: number) => `${Math.round(n).toLocaleString('en-US')} ج.س`

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (!SERVICE_ACCOUNT_RAW) return json({ error: 'FCM not configured' }, 500)

  let payload: {
    user_id?: string
    title?: string
    body?: string
    data?: Record<string, string>
    topup_id?: string
    withdrawal_id?: string
    audience?: 'customers' | 'drivers' | 'all'
  }
  try {
    payload = await req.json()
  } catch {
    return json({ error: 'bad body' }, 400)
  }

  // حراسة: المساران الآمنان (topup_id/withdrawal_id) يصيغ الخادم محتواهما ويشتقّ
  // المستلِم (مالك السجلّ)، فيُسمح بهما للعميل. أمّا البثّ الجماعي (audience) أو
  // الإشعار الحرّ (user_id/title/body عشوائيان) فيُنتحَلان للتصيّد/السبام — نحرسهما
  // بالسرّ المشترك ونرفض إن لم يُضبط (fail-closed).
  const isDerived = Boolean(payload.topup_id || payload.withdrawal_id)
  if (!isDerived) {
    if (!WEBHOOK_SECRET || req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
      return json({ error: 'unauthorized' }, 401)
    }
  }

  const sa = JSON.parse(SERVICE_ACCOUNT_RAW) as ServiceAccount
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  let userId = payload.user_id
  let title = payload.title
  let body = payload.body
  const data = payload.data ?? {}

  // اشتقاق المستخدم والرسالة من معرّف التعبئة/السحب.
  if (payload.topup_id) {
    const { data: t } = await supabase
      .from('topups')
      .select('amount, wallet_id, status')
      .eq('id', payload.topup_id)
      .maybeSingle()
    // لا نُرسل «تمت الموافقة» إلا لتعبئةٍ معتمدة فعلاً (يمنع إشعاراً كاذباً
    // بتمرير معرّف تعبئة معلّقة من عميل عادي).
    if (t?.status !== 'approved') return json({ ok: true, skipped: 'not approved' })
    if (t?.wallet_id) {
      const { data: w } = await supabase
        .from('wallets')
        .select('user_id')
        .eq('id', t.wallet_id)
        .maybeSingle()
      userId = w?.user_id
    }
    title = 'تمت الموافقة على التعبئة'
    body = t ? `أُضيف ${fmt(Number(t.amount))} إلى رصيدك` : 'تمت إضافة رصيدك'
    data.type = 'topup_approved'
  } else if (payload.withdrawal_id) {
    const { data: wd } = await supabase
      .from('withdrawals')
      .select('amount, driver_id, status')
      .eq('id', payload.withdrawal_id)
      .maybeSingle()
    if (wd?.status !== 'approved') return json({ ok: true, skipped: 'not approved' })
    userId = wd?.driver_id
    title = 'تمت الموافقة على السحب'
    body = wd ? `تم تحويل ${fmt(Number(wd.amount))} إلى حسابك` : 'تمت الموافقة على طلب سحبك'
    data.type = 'withdrawal_approved'
  }

  if (!title || !body) return json({ error: 'missing title/body' }, 400)

  const fcmToken = await accessToken(sa)
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`

  // إرسال دفعة رموز بتزامن محدود، مع تنظيف الرموز الميّتة — ثابت الذاكرة.
  const CONCURRENCY = 50
  async function sendBatch(tokens: string[]): Promise<{ sent: number; cleaned: number }> {
    let sent = 0
    let cleaned = 0
    for (let i = 0; i < tokens.length; i += CONCURRENCY) {
      const chunk = tokens.slice(i, i + CONCURRENCY)
      const stale: string[] = []
      await Promise.all(
        chunk.map(async (t) => {
          try {
            const res = await fetch(url, {
              method: 'POST',
              headers: { authorization: `Bearer ${fcmToken}`, 'content-type': 'application/json' },
              body: JSON.stringify({
                message: {
                  token: t,
                  notification: { title, body },
                  data,
                  android: {
                    priority: 'HIGH',
                    notification: {
                      sound: 'default',
                      channel_id: 'qareeb_rides',
                      default_vibrate_timings: true,
                    },
                  },
                },
              }),
            })
            if (res.ok) sent++
            else if (res.status === 404 || res.status === 400) stale.push(t)
          } catch {
            /* خطأ شبكة عابر — نتجاهله ولا نعدّه ميّتاً */
          }
        }),
      )
      if (stale.length) {
        await supabase.from('device_tokens').delete().in('token', stale)
        cleaned += stale.length
      }
    }
    return { sent, cleaned }
  }

  // ===== بثّ جماعي حسب الجمهور: تصفّح على دفعات (keyset) بدل تحميل الكل دفعةً =====
  if (payload.audience) {
    const PAGE = 500
    let after: string | null = null
    let sent = 0
    let cleaned = 0
    for (;;) {
      const { data: rows, error } = await supabase.rpc('audience_device_tokens', {
        p_audience: payload.audience,
        p_after: after,
        p_limit: PAGE,
      })
      if (error) return json({ error: error.message }, 500)
      const pageTokens = ((rows ?? []) as { token: string }[]).map((r) => r.token)
      if (pageTokens.length === 0) break
      after = pageTokens[pageTokens.length - 1]
      const r = await sendBatch(pageTokens)
      sent += r.sent
      cleaned += r.cleaned
      if (pageTokens.length < PAGE) break
    }
    return json({ ok: true, sent, cleaned })
  }

  // ===== مستخدم واحد =====
  if (!userId) return json({ error: 'missing user/audience' }, 400)
  const { data: tokens } = await supabase.from('device_tokens').select('token').eq('user_id', userId)
  const list = (tokens ?? []).map((t) => t.token)
  if (list.length === 0) return json({ ok: true, sent: 0 })
  const r = await sendBatch(list)
  return json({ ok: true, sent: r.sent, cleaned: r.cleaned })
})
