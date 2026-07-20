/**
 * نطاق الخدمة: هل موقعٌ ما داخل إحدى المدن التي فعّلها الأدمن؟
 * إن لم يحدّد الأدمن مدناً (null/فارغ) فلا قيود — الخدمة متاحة في كل مكان
 * (حتى لا يُقفل التطبيق قبل ضبط المدن). المصدر: settings.active_cities + كتالوج المدن.
 */
import { haversineKm } from './pricing'
import { sudanCities } from '@/data/cities'
import type { Settings } from './types'

export function isServedLocation(
  pos: google.maps.LatLngLiteral,
  settings: Settings | null,
): boolean {
  const active = settings?.active_cities
  if (!active || active.length === 0) return true // بلا تحديد → بلا قيود
  const set = new Set(active)
  return sudanCities.some(
    (c) => set.has(c.id) && haversineKm(pos, c.center) <= c.radiusKm,
  )
}

/** اسم أقرب مدينة نشطة (للرسائل) أو null. */
export function nearestActiveCity(
  pos: google.maps.LatLngLiteral,
  settings: Settings | null,
): string | null {
  const active = settings?.active_cities
  if (!active || active.length === 0) return null
  const set = new Set(active)
  let best: { name: string; d: number } | null = null
  for (const c of sudanCities) {
    if (!set.has(c.id)) continue
    const d = haversineKm(pos, c.center)
    if (!best || d < best.d) best = { name: c.name, d }
  }
  return best?.name ?? null
}
