// دالة Edge لإرسال إشعارات Web Push بناءً على Database Webhooks من Supabase.
// تُستدعى عند: رحلة جديدة (إشعار السائقين)، تغيّر حالة رحلة (إشعار الراكب)،
// اعتماد طلب سائق، وإرسال طلب ترحيل. انظر PUSH.md لخطوات النشر والإعداد.
//
// نشر:   supabase functions deploy push --no-verify-jwt
// أسرار: supabase secrets set VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@mail.com
// (SUPABASE_URL و SUPABASE_SERVICE_ROLE_KEY متوفّران تلقائياً في بيئة الدالة.)

import webpush from 'npm:web-push@3.6.7'
import { createClient } from 'npm:@supabase/supabase-js@2'

const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
const SERVICE_ROLE = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
const VAPID_PUBLIC = Deno.env.get('VAPID_PUBLIC_KEY')!
const VAPID_PRIVATE = Deno.env.get('VAPID_PRIVATE_KEY')!
const VAPID_SUBJECT = Deno.env.get('VAPID_SUBJECT') ?? 'mailto:admin@qareeb.sd'

webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE)
const admin = createClient(SUPABASE_URL, SERVICE_ROLE)

interface Notif {
  title: string
  body: string
  url?: string
  tag?: string
}
interface Sub {
  endpoint: string
  p256dh: string
  auth: string
}

async function subsForUsers(userIds: string[]): Promise<Sub[]> {
  if (!userIds.length) return []
  const { data } = await admin.from('push_subscriptions').select('*').in('user_id', userIds)
  return (data ?? []) as Sub[]
}

async function onlineDriverUserIds(): Promise<string[]> {
  const { data } = await admin.from('drivers').select('user_id').eq('is_online', true)
  return (data ?? []).map((d: { user_id: string }) => d.user_id)
}

async function send(subs: Sub[], payload: Notif): Promise<void> {
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
        )
      } catch (e) {
        const code = (e as { statusCode?: number })?.statusCode ?? 0
        if (code === 404 || code === 410) {
          await admin.from('push_subscriptions').delete().eq('endpoint', s.endpoint)
        }
      }
    }),
  )
}

const rideStatusNotif: Record<string, Notif> = {
  accepted: { title: 'قبل السائق رحلتك ✅', body: 'السائق في الطريق إليك.' },
  arrived: { title: 'وصل السائق 📍', body: 'السائق بانتظارك في نقطة الالتقاط.' },
  in_progress: { title: 'بدأت رحلتك 🛣️', body: 'أنت الآن في الطريق إلى وجهتك.' },
  completed: { title: 'انتهت رحلتك ⭐', body: 'نتمنّى لك رحلة موفّقة — قيّم سائقك.' },
}

Deno.serve(async (req) => {
  let body: {
    table?: string
    type?: string
    record?: Record<string, unknown>
    old_record?: Record<string, unknown>
  }
  try {
    body = await req.json()
  } catch {
    return new Response('bad request', { status: 400 })
  }

  const { table, type, record = {}, old_record = {} } = body
  let recipients: string[] = []
  let payload: Notif | null = null

  if (table === 'rides') {
    if (type === 'INSERT' && ['requested', 'searching'].includes(String(record.status))) {
      recipients = await onlineDriverUserIds()
      payload = {
        title: 'طلب رحلة جديد 🚗',
        body: 'لديك طلب رحلة قريب. افتح التطبيق لقبوله.',
        url: '/driver',
        tag: 'new-ride',
      }
    } else if (type === 'UPDATE' && record.status !== old_record.status) {
      const m = rideStatusNotif[String(record.status)]
      if (m && record.customer_id) {
        recipients = [String(record.customer_id)]
        payload = { ...m, url: '/trip', tag: `ride-${record.id}` }
      }
    }
  } else if (
    table === 'driver_applications' &&
    type === 'UPDATE' &&
    record.status === 'approved' &&
    old_record.status !== 'approved'
  ) {
    recipients = [String(record.user_id)]
    payload = {
      title: 'تم اعتماد طلبك 🎉',
      body: 'مرحباً بك سائقاً في قريب. ادخل واجهة السائق.',
      url: '/driver',
      tag: 'driver-approved',
    }
  } else if (
    table === 'commute_orders' &&
    type === 'UPDATE' &&
    record.status === 'dispatched' &&
    old_record.status !== 'dispatched'
  ) {
    recipients = await onlineDriverUserIds()
    payload = {
      title: 'طلب ترحيل جديد 🚐',
      body: 'طلب ترحيل مجمّع متاح للقبول.',
      url: '/driver/commute',
      tag: 'new-commute',
    }
  }

  if (!payload || !recipients.length) {
    return new Response(JSON.stringify({ sent: 0 }), {
      headers: { 'content-type': 'application/json' },
    })
  }

  const subs = await subsForUsers(recipients)
  await send(subs, payload)
  return new Response(JSON.stringify({ sent: subs.length }), {
    headers: { 'content-type': 'application/json' },
  })
})
