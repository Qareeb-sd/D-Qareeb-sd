import type { Libraries } from '@react-google-maps/api'

/**
 * إعدادات خرائط قوقل المشتركة.
 * استخدم useJsApiLoader مع هذه القيم في أي مكوّن يحتاج الخريطة.
 */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

// نحمّل places للبحث عن العناوين لاحقاً.
export const MAPS_LIBRARIES: Libraries = ['places']

// معرّف ثابت لعملية التحميل حتى لا يُعاد تحميل السكربت.
export const MAPS_LOADER_ID = 'qareeb-google-maps'

export const isMapsConfigured = Boolean(GOOGLE_MAPS_API_KEY)

// نمط الخريطة — يخفي نقاط الاهتمام لمظهر نظيف قريب من هوية "قريب".
export const MAP_OPTIONS: google.maps.MapOptions = {
  disableDefaultUI: true,
  clickableIcons: false,
  gestureHandling: 'greedy',
  // إجبار الرسم النقطي (صور بلاطات) بدل Vector/WebGL —
  // بعض أجهزة WebView تفشل في WebGL بصمت فتظهر الخريطة فارغة.
  renderingType: 'RASTER' as google.maps.RenderingType,
  // لون يظهر أثناء تحميل البلاطات (يؤكد أن حاوية الخريطة تُرسم).
  backgroundColor: '#DCE9DF',
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

/**
 * مسافة وزمن الطريق الفعليان عبر Google Directions API.
 * يرجّع null إذا لم تُحمّل الخريطة أو فشل الطلب (فيُستخدم بديل Haversine).
 *
 * لتقليل رسوم قوقل: نُخزّن النتائج مؤقتاً بمفتاح إحداثيات مُقرّبة (~11م)،
 * فأي تكرار لنفس الطلب (تحريك بسيط للخريطة ذهاباً وإياباً) يُخدَم من الكاش.
 */
type RouteResult = { distanceKm: number; durationMin: number }
const routeCache = new Map<string, RouteResult>()
const routeKey = (o: google.maps.LatLngLiteral, d: google.maps.LatLngLiteral) =>
  `${o.lat.toFixed(4)},${o.lng.toFixed(4)}>${d.lat.toFixed(4)},${d.lng.toFixed(4)}`

export async function fetchRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<RouteResult | null> {
  const key = routeKey(origin, destination)
  const cached = routeCache.get(key)
  if (cached) return cached

  // مسار القيادة الفعلي عبر OSRM (OpenStreetMap) — مجاني وبلا مفتاح، يعمل داخل
  // السودان (بديل Google Directions الذي يتطلّب مفتاحاً مُصرّحاً للـJS).
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number }[]
    }
    const route = data.routes?.[0]
    if (!route) return null
    const result: RouteResult = {
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    }
    routeCache.set(key, result)
    return result
  } catch {
    return null
  }
}

type RoutePath = { points: google.maps.LatLngLiteral[]; distanceKm: number; durationMin: number }
const pathCache = new Map<string, RoutePath>()

/**
 * مسار القيادة الكامل (إحداثيات الخطّ) عبر OSRM — لرسم خطّ الملاحة الحيّ على
 * الخريطة أثناء الرحلة. مجاني بلا مفتاح ويعمل داخل السودان.
 */
export async function fetchRoutePath(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<RoutePath | null> {
  const key = routeKey(origin, destination)
  const cached = pathCache.get(key)
  if (cached) return cached
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      routes?: { distance: number; duration: number; geometry: { coordinates: [number, number][] } }[]
    }
    const route = data.routes?.[0]
    if (!route) return null
    const result: RoutePath = {
      points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    }
    pathCache.set(key, result)
    return result
  } catch {
    return null
  }
}

/** خطوة ملاحة واحدة: تعليمة عربية + موقع المناورة + مسافتها. */
export type NavStep = {
  instruction: string
  location: google.maps.LatLngLiteral
  distanceM: number
}
export type RouteNav = {
  points: google.maps.LatLngLiteral[]
  steps: NavStep[]
  distanceKm: number
  durationMin: number
}

/** ترجمة مناورة OSRM إلى تعليمة عربية مختصرة. */
function maneuverAr(
  type: string,
  modifier: string | undefined,
  name: string,
): string {
  const road = name ? ` إلى ${name}` : ''
  const dir = (() => {
    switch (modifier) {
      case 'left':
        return 'يساراً'
      case 'right':
        return 'يميناً'
      case 'sharp left':
        return 'يساراً بحدّة'
      case 'sharp right':
        return 'يميناً بحدّة'
      case 'slight left':
        return 'يساراً قليلاً'
      case 'slight right':
        return 'يميناً قليلاً'
      case 'straight':
        return 'مستقيماً'
      case 'uturn':
        return 'دوران كامل (U)'
      default:
        return ''
    }
  })()
  switch (type) {
    case 'depart':
      return `ابدأ${road}`
    case 'arrive':
      return 'وصلت إلى الوجهة'
    case 'turn':
      return `انعطف ${dir}${road}`
    case 'new name':
    case 'continue':
      return `استمر ${dir || 'مستقيماً'}${road}`
    case 'merge':
      return `اندمج ${dir}${road}`
    case 'on ramp':
      return `اسلك المدخل ${dir}${road}`
    case 'off ramp':
      return `اسلك المخرج ${dir}${road}`
    case 'fork':
      return `عند التفرّع خذ ${dir}${road}`
    case 'roundabout':
    case 'rotary':
      return `ادخل الدوّار${road}`
    case 'end of road':
      return `في نهاية الطريق انعطف ${dir}${road}`
    default:
      return `تابع ${dir || 'مستقيماً'}${road}`
  }
}

/**
 * مسار قيادة مع خطوات الملاحة (turn-by-turn) عبر OSRM — للملاحة داخل التطبيق
 * دون فتح خرائط قوقل خارجياً.
 */
export async function fetchRouteNav(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<RouteNav | null> {
  try {
    const url =
      `https://router.project-osrm.org/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}` +
      `?overview=full&geometries=geojson&steps=true`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      routes?: {
        distance: number
        duration: number
        geometry: { coordinates: [number, number][] }
        legs?: {
          steps?: {
            name: string
            distance: number
            maneuver: { type: string; modifier?: string; location: [number, number] }
          }[]
        }[]
      }[]
    }
    const route = data.routes?.[0]
    if (!route) return null
    const steps: NavStep[] = []
    for (const leg of route.legs ?? []) {
      for (const s of leg.steps ?? []) {
        steps.push({
          instruction: maneuverAr(s.maneuver.type, s.maneuver.modifier, s.name),
          location: { lat: s.maneuver.location[1], lng: s.maneuver.location[0] },
          distanceM: s.distance,
        })
      }
    }
    return {
      points: route.geometry.coordinates.map(([lng, lat]) => ({ lat, lng })),
      steps,
      distanceKm: route.distance / 1000,
      durationMin: route.duration / 60,
    }
  } catch {
    return null
  }
}
