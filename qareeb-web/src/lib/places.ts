/**
 * بحث الأماكن — يستخدم **خرائط قوقل (Places Autocomplete)** متى توفّر مفتاحها،
 * فيعطي نتائج قوقل الحقيقية داخل السودان بأسماء عربية. عند غياب المفتاح أو
 * تعذّر قوقل يعود تلقائياً إلى OpenStreetMap (Photon) ثم إلى قائمة محلية —
 * فلا يتعطّل البحث أبداً. مشترك بين حقل البحث المضمّن وشاشة البحث الكاملة.
 */
import { loadGoogleMaps } from './googleMapsLoader'
import { GOOGLE_MAPS_API_KEY } from './maps'
import { cities } from '@/data/cities'

export interface PlaceSuggestion {
  id: string
  main: string
  sub?: string
  pos: google.maps.LatLngLiteral
  /** معرّف مكان قوقل — يُحلّ إلى إحداثيات عند الاختيار (اقتراحات قوقل بلا إحداثيات). */
  placeId?: string
}

/** أماكن/معالم شائعة في السودان كنتائج فورية وبديل عند تعذّر الشبكة. */
export const LOCAL_PLACES: { name: string; lat: number; lng: number }[] = [
  { name: 'مطار الخرطوم الدولي', lat: 15.5895, lng: 32.5532 },
  { name: 'جامعة الخرطوم', lat: 15.6035, lng: 32.532 },
  { name: 'السوق العربي (وسط الخرطوم)', lat: 15.633, lng: 32.523 },
  { name: 'مستشفى الخرطوم', lat: 15.554, lng: 32.535 },
  { name: 'الخرطوم بحري', lat: 15.64, lng: 32.533 },
  { name: 'سوق أم درمان', lat: 15.647, lng: 32.479 },
  { name: 'كافوري', lat: 15.66, lng: 32.56 },
  { name: 'حي الرياض', lat: 15.57, lng: 32.58 },
  { name: 'المنشية', lat: 15.59, lng: 32.57 },
  { name: 'شمبات', lat: 15.67, lng: 32.51 },
  { name: 'استاد الخرطوم', lat: 15.585, lng: 32.545 },
  { name: 'جامعة السودان للعلوم والتكنولوجيا', lat: 15.61, lng: 32.523 },
  { name: 'جبل أولياء', lat: 15.24, lng: 32.5 },
]

// نضمّ كل مدن التشغيل كنتائج فورية (لا تحتاج شبكة ولا تكلّف طلب قوقل).
const ALL_LOCAL = [
  ...LOCAL_PLACES,
  ...cities
    .filter((c) => !LOCAL_PLACES.some((p) => p.name === c.name))
    .map((c) => ({ name: c.name, lat: c.center.lat, lng: c.center.lng })),
]

const BIAS = { lat: 15.5, lon: 32.55 } // الخرطوم
const SUDAN_BBOX = '21.8,8.6,39.1,22.3' // minLon,minLat,maxLon,maxLat

function subOf(p: Record<string, string>): string {
  return [p.street, p.district, p.city, p.county, p.state]
    .filter((x, i, a) => x && a.indexOf(x) === i)
    .slice(0, 2)
    .join('، ')
}

/* ------------------------------ خرائط قوقل ------------------------------ */

let acSvc: google.maps.places.AutocompleteService | null = null
let session: google.maps.places.AutocompleteSessionToken | null = null

async function searchGoogle(q: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const maps = await loadGoogleMaps()
  if (signal.aborted) throw new DOMException('aborted', 'AbortError')
  if (!acSvc) acSvc = new maps.places.AutocompleteService()
  if (!session) session = new maps.places.AutocompleteSessionToken()
  const preds = await new Promise<google.maps.places.AutocompletePrediction[]>((resolve, reject) => {
    acSvc!.getPlacePredictions(
      { input: q, componentRestrictions: { country: 'sd' }, language: 'ar', sessionToken: session! },
      (res, status) => {
        if (status === maps.places.PlacesServiceStatus.OK && res) resolve(res)
        else if (status === maps.places.PlacesServiceStatus.ZERO_RESULTS) resolve([])
        else reject(new Error(status))
      },
    )
  })
  return preds.slice(0, 7).map((p) => ({
    id: p.place_id,
    main: p.structured_formatting?.main_text || p.description,
    sub: p.structured_formatting?.secondary_text || undefined,
    pos: { lat: 0, lng: 0 }, // تُحلّ عند الاختيار عبر placeCoords
    placeId: p.place_id,
  }))
}

/** يحلّ معرّف مكان قوقل إلى إحداثيات (يُغلق جلسة الإكمال فيُحسب سعرها بالجلسة). */
export async function placeCoords(placeId: string): Promise<google.maps.LatLngLiteral | null> {
  const maps = await loadGoogleMaps()
  const svc = new maps.places.PlacesService(document.createElement('div'))
  return new Promise((resolve) => {
    svc.getDetails(
      { placeId, fields: ['geometry'], sessionToken: session ?? undefined },
      (place, status) => {
        session = null // إنهاء الجلسة الحالية
        const loc = place?.geometry?.location
        resolve(status === maps.places.PlacesServiceStatus.OK && loc ? { lat: loc.lat(), lng: loc.lng() } : null)
      },
    )
  })
}

/* ------------------------------ OpenStreetMap (بديل) ------------------------------ */

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
  return ALL_LOCAL.filter((p) => p.name.includes(q))
    .slice(0, 6)
    .map((p) => ({ id: p.name, main: p.name, pos: { lat: p.lat, lng: p.lng } }))
}

function dedupe(list: PlaceSuggestion[]): PlaceSuggestion[] {
  const seen = new Set<string>()
  return list.filter((s) => {
    const k = s.main.trim()
    if (!k || seen.has(k)) return false
    seen.add(k)
    return true
  })
}

/**
 * بحث الأماكن: أماكن محلية فورية + قوقل (متى توفّر المفتاح) وإلا Photon.
 * يرمي AbortError عند الإلغاء فقط.
 */
export async function searchPlaces(q: string, signal: AbortSignal): Promise<PlaceSuggestion[]> {
  const local = searchLocal(q)
  if (GOOGLE_MAPS_API_KEY) {
    try {
      const g = await searchGoogle(q, signal)
      return dedupe([...local, ...g]).slice(0, 8)
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e
      // قوقل بلا نتائج/خطأ مؤقّت → نكتفي بالمحلّي (لا نلجأ لخرائط أخرى).
      return local
    }
  }
  // لا مفتاح قوقل → البديل المجاني OpenStreetMap ثم المحلّي.
  try {
    return dedupe([...local, ...(await searchPhoton(q, signal))]).slice(0, 8)
  } catch (e) {
    if ((e as Error).name === 'AbortError') throw e
    return local
  }
}
