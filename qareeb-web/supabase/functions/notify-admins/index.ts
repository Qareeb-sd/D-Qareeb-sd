// إشعار الإدارة — Supabase Edge Function (Deno)
// يُرسِل Web Push للأدمن والموظّفين النشطين عند حدث مهمّ (تعبئة/طلب VIP/طوارئ).
//
// خلافاً لـ notify-drivers (بلا حمولة)، هنا نُرسل حمولة مشفّرة (aes128gcm — RFC 8291)
// حتى يظهر نصّ الحدث الصحيح على قفل الشاشة («تعبئة جديدة» / «طلب VIP» / «🆘 طوارئ»)
// دون أن يفتح الأدمن اللوحة. التشفير عبر Web Crypto الأصلي (بلا مكتبات خارجية).
//
// أسرار مطلوبة (نفس أسرار notify-drivers — تُشارَك):
//   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY   — من `npx web-push generate-vapid-keys`
//   VAPID_SUBJECT   (اختياري)             — mailto:you@example.com
//   WEBHOOK_SECRET                        — سرّ مشترك يحرس الاستدعاء
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY يحقنهما Supabase تلقائياً.)
//
// جسم الطلب (JSON): { title, body, url?, tag? }

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
function concat(...arrs: Uint8Array[]): Uint8Array {
  const len = arrs.reduce((n, a) => n + a.length, 0)
  const out = new Uint8Array(len)
  let o = 0
  for (const a of arrs) {
    out.set(a, o)
    o += a.length
  }
  return out
}

// ---------- توقيع VAPID (JWT لكل نقطة نهاية) ----------
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

// ---------- تشفير الحمولة (aes128gcm — RFC 8188/8291) ----------
async function hkdf(
  salt: Uint8Array,
  ikm: Uint8Array,
  info: Uint8Array,
  length: number,
): Promise<Uint8Array> {
  const key = await crypto.subtle.importKey('raw', ikm as BufferSource, 'HKDF', false, ['deriveBits'])
  const bits = await crypto.subtle.deriveBits(
    { name: 'HKDF', hash: 'SHA-256', salt: salt as BufferSource, info: info as BufferSource },
    key,
    length * 8,
  )
  return new Uint8Array(bits)
}

// يبني جسم Web Push مشفّراً لاشتراك واحد. يُرجع Uint8Array (Content-Encoding: aes128gcm).
async function encryptPayload(
  plaintext: Uint8Array,
  uaPublicB64: string,
  authSecretB64: string,
): Promise<Uint8Array> {
  const uaPublic = b64urlToBytes(uaPublicB64) // 65 بايت
  const authSecret = b64urlToBytes(authSecretB64) // 16 بايت
  const salt = crypto.getRandomValues(new Uint8Array(16))

  // زوج مفاتيح ECDH مؤقّت للخادم.
  const asPair = (await crypto.subtle.generateKey(
    { name: 'ECDH', namedCurve: 'P-256' },
    true,
    ['deriveBits'],
  )) as CryptoKeyPair
  const asPublic = new Uint8Array(await crypto.subtle.exportKey('raw', asPair.publicKey)) // 65 بايت

  // السرّ المشترك عبر ECDH مع مفتاح المتصفّح العام.
  const uaKey = await crypto.subtle.importKey(
    'raw',
    uaPublic as BufferSource,
    { name: 'ECDH', namedCurve: 'P-256' },
    false,
    [],
  )
  const ecdh = new Uint8Array(
    await crypto.subtle.deriveBits({ name: 'ECDH', public: uaKey }, asPair.privateKey, 256),
  )

  // IKM = HKDF(salt=authSecret, ikm=ecdh, info="WebPush: info"\0 || uaPub || asPub)
  const enc = new TextEncoder()
  const keyInfo = concat(enc.encode('WebPush: info\0'), uaPublic, asPublic)
  const ikm = await hkdf(authSecret, ecdh, keyInfo, 32)

  // CEK و NONCE عبر RFC 8188.
  const cek = await hkdf(salt, ikm, enc.encode('Content-Encoding: aes128gcm\0'), 16)
  const nonce = await hkdf(salt, ikm, enc.encode('Content-Encoding: nonce\0'), 12)

  // سجلّ واحد: النص + محدّد النهاية 0x02، ثم AES-128-GCM.
  const record = concat(plaintext, new Uint8Array([0x02]))
  const aesKey = await crypto.subtle.importKey('raw', cek as BufferSource, 'AES-GCM', false, ['encrypt'])
  const ct = new Uint8Array(
    await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv: nonce as BufferSource, tagLength: 128 },
      aesKey,
      record as BufferSource,
    ),
  )

  // ترويسة aes128gcm: salt(16) || rs(4) || idlen(1) || keyid(asPub 65) || ciphertext
  const rs = new Uint8Array([0x00, 0x00, 0x10, 0x00]) // 4096
  const idlen = new Uint8Array([asPublic.length]) // 65
  return concat(salt, rs, idlen, asPublic, ct)
}

Deno.serve(async (req) => {
  if (WEBHOOK_SECRET && req.headers.get('x-webhook-secret') !== WEBHOOK_SECRET) {
    return json({ error: 'unauthorized' }, 401)
  }
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return json({ error: 'VAPID keys missing' }, 500)

  let payload: { title?: string; body?: string; url?: string; tag?: string } = {}
  try {
    payload = await req.json()
  } catch {
    /* بلا جسم — نستخدم الافتراضي */
  }
  const notif = {
    title: payload.title ?? '🔔 تنبيه إداري — قريب',
    body: payload.body ?? 'حدثٌ جديد يحتاج مراجعتك في لوحة الإدارة',
    url: payload.url ?? '/admin',
    tag: payload.tag ?? 'qareeb-admin',
  }

  const supabase = createClient(SUPABASE_URL, SERVICE_ROLE)

  // المستلمون: الأدمن + الموظّفون النشطون.
  const [{ data: admins }, { data: staff }] = await Promise.all([
    supabase.from('users').select('id').eq('role', 'admin'),
    supabase.from('staff').select('user_id').eq('active', true),
  ])
  const ids = new Set<string>()
  for (const a of admins ?? []) ids.add(a.id)
  for (const s of staff ?? []) ids.add(s.user_id)
  if (ids.size === 0) return json({ sent: 0, reason: 'no admins' })

  const { data: subs } = await supabase
    .from('push_subscriptions')
    .select('endpoint, p256dh, auth')
    .in('user_id', [...ids])
  if (!subs || subs.length === 0) return json({ sent: 0, reason: 'no subscriptions' })

  const signKey = await importSigningKey()
  const plaintext = new TextEncoder().encode(JSON.stringify(notif))

  const CONCURRENCY = 50
  let sent = 0
  for (let i = 0; i < subs.length; i += CONCURRENCY) {
    const chunk = subs.slice(i, i + CONCURRENCY)
    await Promise.all(
      chunk.map(async (s) => {
        try {
          const body = await encryptPayload(plaintext, s.p256dh, s.auth)
          const res = await fetch(s.endpoint, {
            method: 'POST',
            headers: {
              Authorization: await vapidAuth(s.endpoint, signKey),
              'Content-Encoding': 'aes128gcm',
              'Content-Type': 'application/octet-stream',
              TTL: '600',
              Urgency: 'high',
            },
            body: body as BodyInit,
          })
          if (res.status === 404 || res.status === 410) {
            await supabase.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
          } else if (res.ok) {
            sent++
          }
        } catch {
          /* عطل فردي — لا يوقف البقية */
        }
      }),
    )
  }

  return json({ sent })
})
