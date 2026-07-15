import { loadGoogleMaps } from './googleMapsLoader'

/**
 * تحويل الإحداثيات إلى عنوان حقيقي (اسم شارع/حي) عبر Google Geocoder.
 * يعيد null إن تعذّر — فتُستخدم صياغة احتياطية («موقع محدّد من الخريطة»).
 */

let geocoder: google.maps.Geocoder | null = null

/** يختصر عنوان Google الطويل إلى أول جزأين (شارع/حي) للوضوح. */
function shortAddress(full: string): string {
  const parts = full
    .split(/[،,]/)
    .map((s) => s.trim())
    .filter(Boolean)
  // نتجاهل «السودان» في الذيل إن وُجدت، ونأخذ أوّل جزأين.
  const trimmed = parts.filter((p) => p !== 'السودان' && p !== 'Sudan')
  return trimmed.slice(0, 2).join('، ') || parts.slice(0, 2).join('، ') || full
}

// نمط Plus Code (مثل GH36+XGP) — نتجنّبه لصالح اسم شارع/حي.
const PLUS_CODE = /^[A-Z0-9]{4,}\+[A-Z0-9]+/

export async function reverseGeocode(pos: google.maps.LatLngLiteral): Promise<string | null> {
  try {
    const maps = await loadGoogleMaps()
    if (!geocoder) geocoder = new maps.Geocoder()
    const res = await geocoder.geocode({ location: pos })
    const results = res.results ?? []
    if (!results.length) return null
    // نفضّل نتيجة وصفية (شارع/حي) وليست رمز Plus Code.
    const descriptive = ['route', 'street_address', 'neighborhood', 'sublocality', 'sublocality_level_1', 'premise']
    const preferred =
      results.find(
        (r) =>
          !PLUS_CODE.test(r.formatted_address) &&
          r.types?.some((t) => descriptive.includes(t)),
      ) ??
      results.find((r) => !PLUS_CODE.test(r.formatted_address)) ??
      results[0]
    return shortAddress(preferred.formatted_address)
  } catch {
    return null
  }
}
