import { supabase, isSupabaseConfigured } from './supabase'
import type { RealtimeChannel } from '@supabase/supabase-js'
import type { Ride, RideMessage } from './types'

export type Unsubscribe = () => void

/**
 * اشتراكات Realtime على Supabase — تتطلّب تفعيل النشر على الجداول (schema.sql).
 * في وضع المعاينة (بلا مفاتيح) تُرجع دالة إلغاء فارغة.
 *
 * كل قناة تُبنى عبر makeChannel التي تُعيد الاشتراك تلقائياً عند سقوط الاتصال
 * (شبكة ضعيفة/انقطاع WebSocket — شائع في السودان) بدل أن تبقى القناة ميّتة صامتة.
 */
function makeChannel(
  name: string,
  build: (ch: RealtimeChannel) => RealtimeChannel,
): Unsubscribe {
  if (!isSupabaseConfigured) return () => {}
  let closed = false
  let current: RealtimeChannel | null = null
  let retry: ReturnType<typeof setTimeout> | undefined

  const connect = () => {
    const ch = build(supabase.channel(name))
    current = ch
    ch.subscribe((status) => {
      // نتجاهل تحديثات قناة قديمة أو بعد الإغلاق المتعمّد.
      if (closed || current !== ch) return
      if (status === 'CHANNEL_ERROR' || status === 'TIMED_OUT') {
        clearTimeout(retry)
        retry = setTimeout(() => {
          if (closed || current !== ch) return
          void supabase.removeChannel(ch)
          connect()
        }, 3000)
      }
    })
  }
  connect()

  return () => {
    closed = true
    clearTimeout(retry)
    if (current) void supabase.removeChannel(current)
  }
}

/** يستمع لتغيّرات رحلة محدّدة (قبول / وصول / إكمال / إلغاء). */
export function subscribeToRide(rideId: string, onChange: (ride: Ride) => void): Unsubscribe {
  if (!rideId) return () => {}
  return makeChannel(`ride:${rideId}`, (ch) =>
    ch.on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
      (payload) => onChange(payload.new as Ride),
    ),
  )
}

/** يستمع لرسائل المحادثة الجديدة داخل رحلة محدّدة. */
export function subscribeToRideMessages(
  rideId: string,
  onInsert: (msg: RideMessage) => void,
): Unsubscribe {
  if (!rideId) return () => {}
  return makeChannel(`ride-chat:${rideId}`, (ch) =>
    ch.on(
      'postgres_changes',
      { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` },
      (payload) => onInsert(payload.new as RideMessage),
    ),
  )
}

/**
 * يستمع لظهور طلبات جديدة قابلة للقبول فقط (status=searching) — لواجهة السائق.
 * مُصفّى على الخادم حتى لا تصل تحديثات موقع السائق لكل السائقين (فيضان رسائل).
 */
export function subscribeToRides(onEvent: () => void): Unsubscribe {
  return makeChannel('rides:feed', (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides', filter: 'status=eq.searching' },
      () => onEvent(),
    ),
  )
}

/** يستمع لانضمام/تغيّر ركّاب طلب ترحيل محدّد (لصفحة المنظّم). */
export function subscribeToCommuteMembers(orderId: string, onEvent: () => void): Unsubscribe {
  if (!orderId) return () => {}
  return makeChannel(`commute-members:${orderId}`, (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commute_members', filter: `order_id=eq.${orderId}` },
      () => onEvent(),
    ),
  )
}

/** يستمع لتنبيهات الطوارئ الجديدة (للوحة الأدمن). */
export function subscribeToSos(onEvent: () => void): Unsubscribe {
  return makeChannel('sos:feed', (ch) =>
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'sos_alerts' }, () => onEvent()),
  )
}

/** يستمع لطلبات التعبئة الجديدة/المتغيّرة (للوحة الأدمن). */
export function subscribeToTopups(onEvent: () => void): Unsubscribe {
  return makeChannel('topups:feed', (ch) =>
    ch.on('postgres_changes', { event: '*', schema: 'public', table: 'topups' }, () => onEvent()),
  )
}

/** يستمع لطلبات انضمام السائقين (للوحة الأدمن). */
export function subscribeToDriverApplications(onEvent: () => void): Unsubscribe {
  return makeChannel('driver-apps:feed', (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'driver_applications' },
      () => onEvent(),
    ),
  )
}

/** يستمع لتغيّرات طلبات الترحيل (لواجهة السائق). */
export function subscribeToCommuteOrders(onEvent: () => void): Unsubscribe {
  return makeChannel('commute-orders:feed', (ch) =>
    ch.on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commute_orders' },
      () => onEvent(),
    ),
  )
}
