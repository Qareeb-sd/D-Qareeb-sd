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

export async function reverseGeocode(pos: google.maps.LatLngLiteral): Promise<string | null> {
  try {
    const maps = await loadGoogleMaps()
    if (!geocoder) geocoder = new maps.Geocoder()
    const res = await geocoder.geocode({ location: pos })
    const first = res.results?.[0]
    return first ? shortAddress(first.formatted_address) : null
  } catch {
    return null
  }
}
