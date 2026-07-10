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

/** يستمع لتنبيهات الطوارئ الجديدة (للوحة الأدمن). */
export function subscribeToSos(onEvent: () => void): Unsubscribe {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel('sos:feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'sos_alerts' },
      () => onEvent(),
    )
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** يستمع لطلبات التعبئة الجديدة/المتغيّرة (للوحة الأدمن). */
export function subscribeToTopups(onEvent: () => void): Unsubscribe {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel('topups:feed')
    .on('postgres_changes', { event: '*', schema: 'public', table: 'topups' }, () => onEvent())
    .subscribe()
  return () => {
    void supabase.removeChannel(channel)
  }
}

/** يستمع لطلبات انضمام السائقين (للوحة الأدمن). */
export function subscribeToDriverApplications(onEvent: () => void): Unsubscribe {
  if (!isSupabaseConfigured) return () => {}
  const channel = supabase
    .channel('driver-apps:feed')
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'driver_applications' },
      () => onEvent(),
    )
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
