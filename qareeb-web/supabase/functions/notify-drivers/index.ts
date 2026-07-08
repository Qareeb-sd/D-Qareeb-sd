// إشعار الطلبات الجديدة — Supabase Edge Function (Deno)
// يُرسِل Web Push لكل السائقين «المتصلين» عند إدراج رحلة جديدة.
//
// بلا حمولة (payload-less): أخفّ وأكثر موثوقية على الشبكات الضعيفة، ويكفي
// لإخبار السائق «يوجد طلب» فيفتح التطبيق. توقيع VAPID عبر Web Crypto الأصلي
// (بلا مكتبات خارجية) لتقليل نقاط الفشل.
//
// أسرار مطلوبة (supabase secrets set ...):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   — من `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT   (اختياري)             — mailto:you@example.com
//   WEBHOOK_SECRET                        — سرّ مشترك يحرس الاستدعاء
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً.)

import { createClient } from 'jsr:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY') ?? ''
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY') ?? ''
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@qareeb.sd'
const WEBHOOK_SECRET = Deno.env.get('WEBHOOK_SECRET') ?? ''

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })

function b64urlToBytes(s: string): Uint8Array {
  const t = s.replace(/-/g, '+').replace(/_/g, '/')
  const pad = t.length % 4 ? '='.repeat(4 - (t.length % 4)) : ''
  const raw = atob(t + pad)
  const out = new Uint8Array(raw.length)
  for (let i = 0; i < raw.length; i++) out[i] = raw.charCodeAt(i)
  return out
}
function bytesToB64url(b: Uint8Array): string {
  let s = ''
  for (let i = 0; i < b.length; i++) s += String.fromCharCode(b[i])
  return btoa(s).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}
const strToB64url = (s: string) => bytesToB64url(new TextEncoder().encode(s))

// يبني مفتاح توقيع ECDSA P-256 من مفتاحَي VAPID (بصيغة base64url القياسية).
async function importSigningKey(): Promise<CryptoKey> {
  const pub = b64urlToBytes(VAPID_PUBLIC) // 65 بايت: 0x04 || X(32) || Y(32)
  const priv = b64urlToBytes(VAPID_PRIVATE) // 32 بايت: d
  const jwk: JsonWebKey = {
    kty: 'EC',
    crv: 'P-256',
    x: bytesToB64url(pub.slice(1, 33)),
    y: bytesToB64url(pub.slice(33, 65)),
    d: bytesToB64url(priv),
    ext: true,
    key_ops: ['sign'],
  }
  return crypto.subtle.importKey('jwk', jwk, { name: 'ECDSA', namedCurve: 'P-256' }, false, ['sign'])
}

// ترويسة Authorization بصيغة VAPID (JWT موقّع لكل نقطة نهاية).
async function vapidAuth(endpoint: string, key: CryptoKey): Promise<string> {
  const header = strToB64url(JSON.stringify({ typ: 'JWT', alg: 'ES256' }))
  const payload = strToB64url(
    JSON.stringify({
      aud: new URL(endpoint).origin,
      exp: Math.floor(Date.now() / 1000) + 12 * 3600,
      sub: VAPID_SUBJECT,
    }),
  )
  const input = `${header}.${payload}`
  const sig = new Uint8Array(
    await crypto.subtle.sign(
      { name: 'ECDSA', hash: 'SHA-256' },
      key,
      new TextEncoder().encode(input),
    ),
  )
  return `vapid t=${input}.${bytesToB64url(sig)}, k=${VAPID_PUBLIC}`
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys missing' }, 500)

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // نُرسل فقط للسائقين المتصلين حالياً.
  const { data: drivers } = await supabase.from('drivers').select('user_id').eq('is_online', true)
  const ids = (drivers ?? []).map((d) => d.user_id)
  if (ids.length === 0) return json({ sent: 0, reason: 'no online drivers' })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint')
    .in('user_id', ids)
  if (!subs || subs.length === 0) return json({ sent: 0, reason: 'no subscriptions' })

  const key = await importSigningKey()
  let sent = 0
  await Promise.all(
    subs.map(async (s) => {
      try {
        const res = await fetch(s.endpoint, {
          method: 'POST',
          headers: { Authorization: await vapidAuth(s.endpoint, key), TTL: '120', Urgency: 'high' },
        })
        if (res.status === 404 || res.status === 410) {
          // اشتراك منتهٍ — نظّفه.
          await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        } else if (res.ok) {
          sent++
        }
      } catch {
        /* عطل فردي — لا يوقف البقية */
      }
    }),
  )

  return json({ sent })
})
