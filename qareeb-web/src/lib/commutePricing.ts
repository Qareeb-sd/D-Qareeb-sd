/**
 * تسعير الترحيل — يعيد استخدام منطق المشوار العادي:
 *   أجرة الراكب اليومية = (منزله → الوجهة) بأسعار فترة المركبة، ×2 ذهاباً وإياباً،
 *   ناقص خصم الترحيل الاختياري، مقرّبة لأقرب 100.
 *   الإجمالي الشهري = الأجرة اليومية × أيام الأسبوع × أسابيع الشهر.
 */
import { computeFare, estimateRoute, type PeriodRate, type Period } from './pricing'

/** فترة التسعير من وقت «HH:MM» (نفس حدود currentPeriod). */
export function periodFromTime(hhmm: string): Period {
  const h = Number((hhmm || '07:00').split(':')[0])
  if (h < 6) return 'night'
  if (h < 14) return 'morning'
  if (h < 17) return 'afternoon'
  return 'evening'
}

/** أجرة راكب واحد لليوم: منزله → الوجهة (×2 إن ذهاب وإياب)، بعد الخصم. */
export function memberDailyFare(
  home: google.maps.LatLngLiteral,
  dest: google.maps.LatLngLiteral,
  rate: PeriodRate,
  roundTrip: boolean,
  discount = 0, // كسر 0..1
): number {
  const leg = estimateRoute(home, dest)
  let f = computeFare(leg.distanceKm, leg.durationMin, rate)
  if (roundTrip) f *= 2
  if (discount > 0) f *= 1 - Math.min(0.95, Math.max(0, discount))
  return Math.round(f / 100) * 100
}

/** الإجمالي الشهري لراكب = أجرة يومية × أيام الأسبوع × أسابيع الشهر. */
export function monthlyTotal(dailyFare: number, daysPerWeek: number, weeksPerMonth = 4): number {
  return Math.round(dailyFare * Math.max(1, daysPerWeek) * Math.max(1, weeksPerMonth))
}
