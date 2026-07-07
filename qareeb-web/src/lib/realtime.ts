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
