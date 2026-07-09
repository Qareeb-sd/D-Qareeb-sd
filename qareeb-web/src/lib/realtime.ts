import { supabase, isSupabaseConfigured } from './supabase'
import type { Ride } from './types'

export type Unsubscribe = () => void

/**
 * اشتراكات Realtime على جدول الرحلات (Supabase Realtime).
 * تتطلّب تفعيل النشر على الجدول (انظر supabase/schema.sql).
 * في وضع المعاينة (بدون مفاتيح) تُرجع دالة إلغاء فارغة.
 */

/** يستمع لتغيّرات رحلة محدّدة (قبول / وصول / إكمال / إلغاء). */
export function subscribeToRide(
  rideId: string,
  onChange: (ride: Ride) => void,
): Unsubscribe {
  if (!isSupabaseConfigured || !rideId) return () => {}
  const channel = supabase
    .channel(`ride:${rideId}`)
    .on(
      'postgres_changes',
      { event: 'UPDATE', schema: 'public', table: 'rides', filter: `id=eq.${rideId}` },
      (payload) => onChange(payload.new as Ride),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** يستمع لأي تغيّر على الرحلات (لواجهة السائق) ويستدعي onEvent لإعادة الجلب. */
export function subscribeToRides(onEvent: () => void): Unsubscribe {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel('rides:feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'rides' },
      () => onEvent(),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** يستمع لانضمام/تغيّر ركّاب طلب ترحيل محدّد (لصفحة المنظّم). */
export function subscribeToCommuteMembers(
  orderId: string,
  onEvent: () => void,
): Unsubscribe {
  if (!isSupabaseConfigured || !orderId) return () => {}
  const channel = supabase
    .channel(`commute-members:${orderId}`)
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'commute_members',
        filter: `order_id=eq.${orderId}`,
      },
      () => onEvent(),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

export interface LatLng {
  lat: number
  lng: number
}

/**
 * بثّ موقع السائق أثناء الرحلة عبر قناة Broadcast (بلا كتابة في القاعدة).
 * يرجّع دالتي إرسال وإيقاف. لا شيء يحدث في وضع المعاينة.
 */
export function createLocationBroadcaster(rideId: string): {
  send: (pos: LatLng) => void
  stop: () => void
} {
  if (!isSupabaseConfigured || !rideId) return { send: () => {}, stop: () => {} }
  const channel = supabase.channel(`ride-loc:${rideId}`)
  channel.subscribe()
  return {
    send: (pos) => {
      void channel.send({ type: 'broadcast', event: 'loc', payload: pos })
    },
    stop: () => {
      void supabase.removeChannel(channel)
    },
  }
}

/** يستمع لموقع السائق اللحظي (لجهة الراكب). */
export function subscribeToDriverLocation(
  rideId: string,
  onLoc: (pos: LatLng) => void,
): Unsubscribe {
  if (!isSupabaseConfigured || !rideId) return () => {}
  const channel = supabase
    .channel(`ride-loc:${rideId}`)
    .on('broadcast', { event: 'loc' }, ({ payload }) => onLoc(payload as LatLng))
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** يستمع لتغيّرات طلبات الترحيل (لواجهة السائق). */
export function subscribeToCommuteOrders(onEvent: () => void): Unsubscribe {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel('commute-orders:feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'commute_orders' },
      () => onEvent(),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}
