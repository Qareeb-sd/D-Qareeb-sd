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

/** تحويل عبر Google Geocoder (يتطلّب تفعيل Geocoding API على المفتاح). */
async function reverseGoogle(pos: google.maps.LatLngLiteral): Promise<string | null> {
  try {
    const maps = await loadGoogleMaps()
    if (!geocoder) geocoder = new maps.Geocoder()
    const res = await geocoder.geocode({ location: pos })
    const results = res.results ?? []
    if (!results.length) return null
    const descriptive = ['route', 'street_address', 'neighborhood', 'sublocality', 'sublocality_level_1', 'premise']
    const preferred =
      results.find(
        (r) => !PLUS_CODE.test(r.formatted_address) && r.types?.some((t) => descriptive.includes(t)),
      ) ??
      results.find((r) => !PLUS_CODE.test(r.formatted_address)) ??
      results[0]
    return shortAddress(preferred.formatted_address)
  } catch {
    return null
  }
}

/** بديل مجاني عبر Photon (OpenStreetMap) — يعمل بلا مفتاح داخل السودان. */
async function reversePhoton(pos: google.maps.LatLngLiteral): Promise<string | null> {
  try {
    const res = await fetch(
      `https://photon.komoot.io/reverse?lat=${pos.lat}&lon=${pos.lng}&lang=default`,
    )
    if (!res.ok) return null
    const data = (await res.json()) as { features?: { properties: Record<string, string> }[] }
    const p = data.features?.[0]?.properties
    if (!p) return null
    const parts = [p.name, p.street, p.district, p.city, p.state]
      .filter(Boolean)
      .filter((x, i, a) => a.indexOf(x) === i)
    return parts.slice(0, 2).join('، ') || null
  } catch {
    return null
  }
}

/**
 * تحويل الإحداثيات إلى عنوان: يجرّب Google (إن توفّر المفتاح) ثم Photon المجاني.
 * فلا يفشل التحويل حتى لو لم تكن Geocoding API مفعّلة على مفتاح قوقل.
 */
export async function reverseGeocode(pos: google.maps.LatLngLiteral): Promise<string | null> {
  const g = await reverseGoogle(pos)
  if (g) return g
  return reversePhoton(pos)
}
