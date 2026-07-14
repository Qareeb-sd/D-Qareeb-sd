// إشعار الطلبات الجديدة عبر FCM (HTTP v1) — Supabase Edge Function (Deno).
// يُرسل إشعاراً أصلياً لكل السائقين «المتصلين» فيصلهم والتطبيق في الخلفية أو
// الشاشة مقفلة. يعتمد رموز أجهزة FCM المحفوظة في جدول device_tokens.
//
// أسرار مطلوبة (supabase secrets set ...):
//   FCM_SERVICE_ACCOUNT  — محتوى ملف حساب خدمة Firebase (JSON كاملاً كسلسلة)
//   WEBHOOK_SECRET (اختياري) — سرّ مشترك يحرس الاستدعاء عبر ترويسة x-webhook-secret
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

// يحوّل مفتاح PEM (PKCS8) إلى CryptoKey للتوقيع RS256.
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

Deno.serve(async (req) => {
  if (req.method !== 'POST') return json({ error: 'method not allowed' }, 405)
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    // يُسمح أيضاً بالاستدعاء من العميل المصدَّق (JWT) — لا نُلزم السرّ إن لم يُضبط.
  }
  if (!SERVICE_ACCOUNT_RAW) return json({ error: 'FCM not configured' }, 500)

  let ride_id: string | undefined
  try {
    ride_id = (await req.json())?.ride_id
  } catch {
    return json({ error: 'bad body' }, 400)
  }
  if (!ride_id) return json({ error: 'ride_id required' }, 400)

  const sa = JSON.parse(SERVICE_ACCOUNT_RAW) as ServiceAccount
  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // الرحلة يجب أن تكون في حالة بحث (لا نُشعِر عن رحلة مأخوذة/ملغاة).
  const { data: ride } = await supabase
    .from('rides')
    .select('id, status, service_id, pickup_address, fare')
    .eq('id', ride_id)
    .maybeSingle()
  if (!ride || ride.status !== 'searching') return json({ ok: true, skipped: true })

  // رموز أجهزة السائقين المتصلين فقط.
  const { data: drivers } = await supabase.from('drivers').select('user_id').eq('is_online', true)
  const ids = (drivers ?? []).map((d) => d.user_id)
  if (ids.length === 0) return json({ ok: true, sent: 0 })

  const { data: tokens } = await supabase
    .from('device_tokens')
    .select('token')
    .in('user_id', ids)
  const list = (tokens ?? []).map((t) => t.token)
  if (list.length === 0) return json({ ok: true, sent: 0 })

  const token = await accessToken(sa)
  const url = `https://fcm.googleapis.com/v1/projects/${sa.project_id}/messages:send`
  const title = 'طلب رحلة جديد'
  const body = ride.pickup_address ? `انطلاق: ${ride.pickup_address}` : 'يوجد طلب جديد قريب منك'

  let sent = 0
  const stale: string[] = []
  await Promise.all(
    list.map(async (t) => {
      const res = await fetch(url, {
        method: 'POST',
        headers: { authorization: `Bearer ${token}`, 'content-type': 'application/json' },
        body: JSON.stringify({
          message: {
            token: t,
            notification: { title, body },
            data: { ride_id: String(ride.id), type: 'new_ride' },
            android: {
              priority: 'HIGH',
              notification: { sound: 'default', channel_id: 'qareeb_rides', default_vibrate_timings: true },
            },
          },
        }),
      })
      if (res.ok) sent++
      else if (res.status === 404 || res.status === 400) stale.push(t) // رمز منتهٍ
    }),
  )

  // نظافة: احذف الرموز المنتهية.
  if (stale.length) await supabase.from('device_tokens').delete().in('token', stale)

  return json({ ok: true, sent, cleaned: stale.length })
})
