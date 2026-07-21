/**
 * تسعير الترحيل — نفس سعر المشوار العادي، ناقص خصم الترحيل:
 *   أجرة الراكب اليومية = سعر المشوار (منزله → الوجهة) بأسعار فترة المركبة،
 *   ×2 إن كان ذهاباً وإياباً (رحلتان)، ثم × (1 − الخصم)، مقرّبة لأقرب 100.
 *   الإجمالي الشهري = الأجرة اليومية × أيام الأسبوع × أسابيع الشهر.
 */
import { computeFare, estimateRoute, periodFor, type PeriodRate, type Period } from './pricing'

/** فترة التسعير من وقت «HH:MM» — نفس حدود currentPeriod تماماً (بما فيها 17:00). */
export function periodFromTime(hhmm: string): Period {
  const [hs, ms] = (hhmm || '07:00').split(':')
  return periodFor(Number(hs) || 0, Number(ms) || 0)
}

/** أجرة راكب واحد لليوم = سعر المشوار العادي (×2 إن ذهاباً وإياباً) ناقص خصم الترحيل. */
export function memberDailyFare(
  home: google.maps.LatLngLiteral,
  dest: google.maps.LatLngLiteral,
  rate: PeriodRate,
  roundTrip: boolean,
  discount = 0, // كسر 0..1
): number {
  const leg = estimateRoute(home, dest)
  let f = computeFare(leg.distanceKm, leg.durationMin, rate)
  if (roundTrip) f *= 2 // ذهاب وإياب = رحلتان
  if (discount > 0) f *= 1 - Math.min(0.95, Math.max(0, discount))
  return Math.round(f / 100) * 100
}

/**
 * الإجمالي الشهري لراكب = أجرة يومية × أيام الأسبوع × أسابيع الشهر،
 * ناقص خصم الاشتراك الشهري (تشجيعاً على الخطّة الشهرية). مقرّب لأقرب 100.
 */
export function monthlyTotal(
  dailyFare: number,
  daysPerWeek: number,
  weeksPerMonth = 4,
  monthlyDiscount = 0, // كسر 0..1
): number {
  let total = dailyFare * Math.max(1, daysPerWeek) * Math.max(1, weeksPerMonth)
  if (monthlyDiscount > 0) total *= 1 - Math.min(0.95, Math.max(0, monthlyDiscount))
  return Math.round(total / 100) * 100
}
