/**
 * بحث الأماكن عبر OpenStreetMap (Photon) — مجاني بلا مفتاح، يعمل داخل السودان
 * بأسماء عربية، منحاز للخرطوم ومصفّى داخل حدود السودان. مع بديل محلي عند
 * تعذّر الشبكة. مشترك بين حقل البحث المضمّن وشاشة البحث الكاملة.
 */

export interface PlaceSuggestion {
  id: string
  main: string
  sub?: string
  pos: google.maps.LatLngLiteral
}

/** أماكن شائعة في السودان كبديل محلي عند تعذّر الإنترنت. */
export const LOCAL_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'مطار الخرطوم الدولي', lat: 15.5895, lng: 32.5532 },
  { name: 'جامعة الخرطوم', lat: 15.6035, lng: 32.532 },
  { name: 'السوق العربي (وسط الخرطوم)', lat: 15.633, lng: 32.523 },
  { name: 'مستشفى الخرطوم', lat: 15.554, lng: 32.535 },
  { name: 'الخرطوم بحري', lat: 15.64, lng: 32.533 },
  { name: 'أم درمان', lat: 15.6445, lng: 32.4777 },
  { name: 'سوق أم درمان', lat: 15.647, lng: 32.479 },
  { name: 'كافوري', lat: 15.66, lng: 32.56 },
  { name: 'حي الرياض', lat: 15.57, lng: 32.58 },
  { name: 'المنشية', lat: 15.59, lng: 32.57 },
  { name: 'شمبات', lat: 15.67, lng: 32.51 },
  { name: 'استاد الخرطوم', lat: 15.585, lng: 32.545 },
  { name: 'جامعة السودان للعلوم والتكنولوجيا', lat: 15.61, lng: 32.523 },
  { name: 'جبل أولياء', lat: 15.24, lng: 32.5 },
]

const BIAS = { lat: 15.5, lon: 32.55 } // الخرطوم
const SUDAN_BBOX = '21.8,8.6,39.1,22.3' // minLon,minLat,maxLon,maxLat

function subOf(p: Record<string, string>): string {
  return [p.street, p.district, p.city, p.county, p.state]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 2)
    .join('، ')
}

async function searchPhoton(q: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const url =
    `https://photon.komoot.io/api/?q=${encodeURIComponent(q)}` +
    `&limit=8&lang=default&lat=${BIAS.lat}&lon=${BIAS.lon}&bbox=${SUDAN_BBOX}`
  const res = await fetch(url, { signal })
  if (!res.ok) throw new Error('photon')
  const data = (await res.json()) as {
    features: { properties: Record<string, string>; geometry: { coordinates: [number, number] } }[]
  }
  return data.features
    .filter((f) => f.geometry?.coordinates)
    .map((f, i) => {
      const p = f.properties
      return {
        id: `${p.osm_id ?? i}-${i}`,
        main: p.name || p.street || p.city || p.state || 'موقع',
        sub: subOf(p) || undefined,
        pos: { lat: f.geometry.coordinates[1], lng: f.geometry.coordinates[0] },
      }
    })
}

export function searchLocal(q: string): PlaceSuggestion[] {
  return LOCAL_PLACES.filter((p) => p.name.includes(q))
    .slice(0, 8)
    .map((p) => ({ id: p.name, main: p.name, pos: { lat: p.lat, lng: p.lng } }))
}

/** يحاول Photon ثم يعود للأماكن المحلية. يرمي AbortError عند الإلغاء. */
export async function searchPlaces(q: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  try {
    const results = await searchPhoton(q, signal)
    return results.length ? results : searchLocal(q)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    return searchLocal(q)
  }
}
