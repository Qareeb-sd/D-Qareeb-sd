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
