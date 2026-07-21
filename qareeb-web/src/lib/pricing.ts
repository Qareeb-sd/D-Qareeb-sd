import type { Settings, ServicePricing } from './types'

/**
 * محرّك تسعير "قريب" — يطبّق استراتيجية الشرائح:
 *
 *   الأجرة = فتح العداد
 *          + (كيلومترات الشريحة الحضرية × سعرها)
 *          + (كيلومترات الشريحة البعيدة × سعرها)
 *          + (الدقائق × سعر الدقيقة)
 *          × معامل التسعير الديناميكي (Surge)
 *
 * - الشريحة 0 (0..tier1_max_km): مغطّاة بأجرة فتح العداد.
 * - الشريحة 1 (tier1..tier2): النطاق الحضري.
 * - الشريحة 2 (> tier2): تسعير تعويضي (رحلة العودة فارغاً).
 */

const clamp = (n: number, lo: number, hi: number) => Math.max(lo, Math.min(hi, n))

export interface FareBreakdown {
  base: number
  distance: number
  time: number
  surgeMultiplier: number
  total: number
}

export function estimateFare(params: {
  distanceKm: number
  durationMin: number
  pricing: ServicePricing
  settings: Settings
}): FareBreakdown {
  const { distanceKm, durationMin, pricing, settings } = params
  const t1 = settings.tier1_max_km
  const t2 = settings.tier2_max_km

  const urbanKm = clamp(distanceKm - t1, 0, Math.max(0, t2 - t1))
  const farKm = Math.max(0, distanceKm - t2)

  const base = pricing.base_fare
  const distance = urbanKm * pricing.per_km_urban + farKm * pricing.per_km_far
  const time = Math.max(0, durationMin) * pricing.per_minute

  const surge = settings.surge_multiplier || 1
  const total = Math.round((base + distance + time) * surge)

  return { base, distance, time, surgeMultiplier: surge, total }
}

// ============================================================
//  التسعير حسب الفترة الزمنية (النموذج الجديد)
//  الأجرة = فتح العداد + سعر الكيلومتر × كم + سعر الدقيقة × دقيقة
//  ثم الحدّ الأدنى min_fare فقط (بلا سقف)، وتقرّب لأقرب 100.
// ============================================================
export type Period = 'morning' | 'afternoon' | 'evening' | 'night'

export interface PeriodRate {
  base_fare: number
  per_km: number
  per_min: number
  min_fare: number
}

export const PERIOD_LABEL: Record<Period, string> = {
  morning: 'صباحاً',
  afternoon: 'ظهراً',
  evening: 'مساءً',
  night: 'ليلاً',
}

/** الفترة الحالية حسب توقيت الخرطوم (UTC+2). */
/** فترة التسعير من ساعة ودقيقة — مصدر واحد للحدود يشترك فيه الطلب الفوري والترحيل. */
export function periodFor(h: number, m: number): Period {
  if (h < 6) return 'night' // 00:00–05:59
  if (h < 14) return 'morning' // 06:00–13:59
  if (h < 17 || (h === 17 && m === 0)) return 'afternoon' // 14:00–17:00
  return 'evening' // 17:01–23:59
}

export function currentPeriod(now: Date = new Date()): Period {
  const utcMs = now.getTime() + now.getTimezoneOffset() * 60000
  const kh = new Date(utcMs + 2 * 3600000)
  return periodFor(kh.getHours(), kh.getMinutes())
}

/** يحسب الأجرة بنموذج الفترات: حدّ أدنى فقط + تقريب لأقرب 100. */
export function computeFare(km: number, min: number, rate: PeriodRate): number {
  const raw = rate.base_fare + rate.per_km * Math.max(0, km) + rate.per_min * Math.max(0, min)
  const floored = Math.max(raw, rate.min_fare)
  return Math.round(floored / 100) * 100
}

/** تفصيل الأجرة لإيصال مفصّل (طلب المشوار + المسافة + الوقت + الحد الأدنى + الخصم). */
export interface FareParts {
  base: number // طلب المشوار
  distance: number // مقابل المسافة (per_km × كم)
  time: number // مقابل الوقت (per_min × دقيقة)
  minApplied: boolean // هل طُبِّق الحد الأدنى؟
  gross: number // الإجمالي قبل الخصم (مقرّب لأقرب 100)
  discount: number // قيمة الخصم
  total: number // الإجمالي النهائي
}

export function fareBreakdown(
  km: number,
  min: number,
  rate: PeriodRate,
  discount = 0,
): FareParts {
  const base = Math.round(rate.base_fare)
  const distance = Math.round(rate.per_km * Math.max(0, km))
  const time = Math.round(rate.per_min * Math.max(0, min))
  const raw = rate.base_fare + rate.per_km * Math.max(0, km) + rate.per_min * Math.max(0, min)
  const gross = computeFare(km, min, rate)
  const d = Math.max(0, Math.round(discount))
  return {
    base,
    distance,
    time,
    minApplied: raw < rate.min_fare,
    gross,
    discount: d,
    total: Math.max(0, gross - d),
  }
}

/** مسافة بالكيلومتر بين نقطتين (Haversine). */
export function haversineKm(
  a: google.maps.LatLngLiteral,
  b: google.maps.LatLngLiteral,
): number {
  const R = 6371
  const dLat = ((b.lat - a.lat) * Math.PI) / 180
  const dLng = ((b.lng - a.lng) * Math.PI) / 180
  const lat1 = (a.lat * Math.PI) / 180
  const lat2 = (b.lat * Math.PI) / 180
  const h =
    Math.sin(dLat / 2) ** 2 + Math.sin(dLng / 2) ** 2 * Math.cos(lat1) * Math.cos(lat2)
  return 2 * R * Math.asin(Math.sqrt(h))
}

// معامل لتقريب مسافة الطريق الفعلية من المسافة المستقيمة.
const ROAD_FACTOR = 1.3
// متوسط سرعة تقديري داخل المدينة (كم/س) لتقدير الزمن قبل ربط Directions API.
const AVG_SPEED_KMH = 25

/** تقدير مسافة الطريق والزمن بين نقطتين (بديل مؤقت عن Directions API). */
export function estimateRoute(a: google.maps.LatLngLiteral, b: google.maps.LatLngLiteral) {
  const distanceKm = haversineKm(a, b) * ROAD_FACTOR
  const durationMin = (distanceKm / AVG_SPEED_KMH) * 60
  return { distanceKm, durationMin }
}
