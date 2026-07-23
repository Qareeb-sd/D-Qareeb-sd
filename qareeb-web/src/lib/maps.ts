import type { Libraries } from '@react-google-maps/api'

/**
 * إعدادات خرائط قوقل المشتركة.
 * استخدم useJsApiLoader مع هذه القيم في أي مكوّن يحتاج الخريطة.
 */
export const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY ?? ''

/**
 * خادم توجيه المسارات (OSRM). الافتراضي هو الخادم العام المجاني — ممتاز للاختبار
 * وأوّل الإطلاق، لكنه بلا ضمان توفّر وقد يُبطئ/يحظر مع الاستخدام الكثيف.
 *
 * ⚠️ قبل الإطلاق الكثيف (راجع docs/PRE_LAUNCH.md): استضِف OSRM على خادمك الخاص
 * ثم اضبط المتغيّر البيئي VITE_OSRM_URL في ملف .env — بلا أيّ تعديل على الكود:
 *   VITE_OSRM_URL=https://osrm.your-domain.com
 */
export const OSRM_BASE_URL = (
  import.meta.env.VITE_OSRM_URL ?? 'https://router.project-osrm.org'
).replace(/\/+$/, '')

/**
 * خادم Valhalla الخاص لملاحة الكابتن (المسار + خطوات الاتجاه) — عالية الحجم،
 * فتبقى مجانية على خادمك بدل فاتورة توجيه قوقل. متى ضُبط VITE_VALHALLA_URL
 * تُستخدَم Valhalla؛ وإلا يعود الكود تلقائياً إلى OSRM (فلا يتعطّل قبل الاستضافة).
 *   VITE_VALHALLA_URL=https://valhalla.your-domain.com
 * (تقدير الأجرة للعميل يمرّ عبر Google Directions لدقّة حركة المرور — نداء واحد
 *  لكل حجز، منخفض الحجم.)
 */
export const VALHALLA_BASE_URL = (import.meta.env.VITE_VALHALLA_URL ?? '').replace(/\/+$/, '')
export const isValhallaConfigured = Boolean(VALHALLA_BASE_URL)

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

// ---------------------------------------------------------------------------
//  عميل Valhalla (لملاحة الكابتن). واجهته تختلف عن OSRM: طلب GET بمعامل json،
//  والمسار يعود كسلسلة polyline6 مُرمّزة، والمناورات بأنواع رقمية + فهرس بداية
//  في المسار. نفكّ الترميز ونحوّل النوع الرقمي إلى نمط OSRM حتى تبقى منطق الأسهم
//  والتعليمات العربية القائمة كما هي.
// ---------------------------------------------------------------------------

/** فكّ ترميز polyline من Valhalla (الدقّة 6 = 1e6). */
function decodePolyline(str: string, precision = 6): google.maps.LatLngLiteral[] {
  let index = 0,
    lat = 0,
    lng = 0
  const coords: google.maps.LatLngLiteral[] = []
  const factor = Math.pow(10, precision)
  while (index < str.length) {
    let result = 1,
      shift = 0,
      b: number
    do {
      b = str.charCodeAt(index++) - 63 - 1
      result += b << shift
      shift += 5
    } while (b >= 0x1f)
    lat += result & 1 ? ~(result >> 1) : result >> 1
    result = 1
    shift = 0
    do {
      b = str.charCodeAt(index++) - 63 - 1
      result += b << shift
      shift += 5
    } while (b >= 0x1f)
    lng += result & 1 ? ~(result >> 1) : result >> 1
    coords.push({ lat: lat / factor, lng: lng / factor })
  }
  return coords
}

/** تحويل نوع مناورة Valhalla الرقمي إلى نمط OSRM (type + modifier) المستخدم للأسهم. */
function valhallaManeuver(type: number): { type: string; modifier?: string } {
  switch (type) {
    case 1: case 2: case 3: return { type: 'depart' }
    case 4: case 5: case 6: return { type: 'arrive' }
    case 7: return { type: 'new name', modifier: 'straight' }
    case 8: return { type: 'continue', modifier: 'straight' }
    case 9: return { type: 'turn', modifier: 'slight right' }
    case 10: return { type: 'turn', modifier: 'right' }
    case 11: return { type: 'turn', modifier: 'sharp right' }
    case 12: case 13: return { type: 'turn', modifier: 'uturn' }
    case 14: return { type: 'turn', modifier: 'sharp left' }
    case 15: return { type: 'turn', modifier: 'left' }
    case 16: return { type: 'turn', modifier: 'slight left' }
    case 17: return { type: 'on ramp', modifier: 'straight' }
    case 18: return { type: 'on ramp', modifier: 'right' }
    case 19: return { type: 'on ramp', modifier: 'left' }
    case 20: return { type: 'off ramp', modifier: 'right' }
    case 21: return { type: 'off ramp', modifier: 'left' }
    case 22: return { type: 'continue', modifier: 'straight' }
    case 23: return { type: 'fork', modifier: 'slight right' }
    case 24: return { type: 'fork', modifier: 'slight left' }
    case 25: return { type: 'merge', modifier: 'straight' }
    case 26: return { type: 'roundabout' }
    case 27: return { type: 'continue', modifier: 'straight' }
    default: return { type: 'continue', modifier: 'straight' }
  }
}

type ValhallaManeuver = {
  type: number
  length?: number
  time?: number
  begin_shape_index?: number
  street_names?: string[]
}
type ValhallaTrip = {
  points: google.maps.LatLngLiteral[]
  distanceKm: number
  durationMin: number
  maneuvers: ValhallaManeuver[]
}

/** طلب مسار من Valhalla (GET ?json= لتفادي preflight). null عند أي فشل. */
async function valhallaTrip(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<ValhallaTrip | null> {
  if (!isValhallaConfigured) return null
  try {
    const body = {
      locations: [
        { lat: origin.lat, lon: origin.lng },
        { lat: destination.lat, lon: destination.lng },
      ],
      costing: 'auto',
      directions_options: { units: 'kilometers' },
      shape_format: 'polyline6',
    }
    const url = `${VALHALLA_BASE_URL}/route?json=${encodeURIComponent(JSON.stringify(body))}`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as {
      trip?: {
        summary?: { length?: number; time?: number }
        legs?: { shape?: string; maneuvers?: ValhallaManeuver[] }[]
      }
    }
    const trip = data.trip
    const leg = trip?.legs?.[0]
    if (!trip || !leg?.shape) return null
    return {
      points: decodePolyline(leg.shape, 6),
      distanceKm: trip.summary?.length ?? 0,
      durationMin: (trip.summary?.time ?? 0) / 60,
      maneuvers: leg.maneuvers ?? [],
    }
  } catch {
    return null
  }
}

/** مسافة/زمن عبر OSRM (بديل احتياطي متى لم تُضبط Valhalla). */
async function osrmRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<RouteResult | null> {
  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
      `${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=false`
    const res = await fetch(url)
    if (!res.ok) return null
    const data = (await res.json()) as { routes?: { distance: number; duration: number }[] }
    const route = data.routes?.[0]
    if (!route) return null
    return { distanceKm: route.distance / 1000, durationMin: route.duration / 60 }
  } catch {
    return null
  }
}

/**
 * مسافة/زمن الطريق عبر Google Directions (واعية بحركة المرور) باستخدام SDK
 * المُحمّل — نداء واحد لكل حجز فقط (منخفض الحجم)، فيعطي العميل تقديراً أدقّ.
 * يرجّع null إن لم تُحمّل الخريطة أو فشل الطلب فيُستخدم البديل.
 */
async function googleTrafficRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<RouteResult | null> {
  const g = (globalThis as unknown as { google?: typeof google }).google
  if (!g?.maps?.DirectionsService) return null
  try {
    const ds = new g.maps.DirectionsService()
    const res = await ds.route({
      origin,
      destination,
      travelMode: g.maps.TravelMode.DRIVING,
      drivingOptions: { departureTime: new Date(), trafficModel: g.maps.TrafficModel.BEST_GUESS },
    })
    const leg = res.routes?.[0]?.legs?.[0]
    if (!leg?.distance) return null
    const durSec = leg.duration_in_traffic?.value ?? leg.duration?.value ?? 0
    return { distanceKm: leg.distance.value / 1000, durationMin: durSec / 60 }
  } catch {
    return null
  }
}

/**
 * تقدير مسافة/زمن الرحلة لحساب الأجرة. الترتيب: Google Directions (واعية بحركة
 * المرور، منخفضة الحجم) ← ثم خادم التوجيه الذاتي (Valhalla/OSRM) ← ثم null
 * (فيلجأ المتصل إلى تقدير Haversine).
 */
export async function fetchRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<RouteResult | null> {
  const key = routeKey(origin, destination)
  const cached = routeCache.get(key)
  if (cached) return cached

  const gr = await googleTrafficRoute(origin, destination)
  if (gr) {
    routeCache.set(key, gr)
    return gr
  }
  const va = await valhallaTrip(origin, destination)
  if (va) {
    const r: RouteResult = { distanceKm: va.distanceKm, durationMin: va.durationMin }
    routeCache.set(key, r)
    return r
  }
  const osrm = await osrmRoute(origin, destination)
  if (osrm) {
    routeCache.set(key, osrm)
    return osrm
  }
  return null
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
  // ملاحة الكابتن (عالية الحجم) عبر Valhalla الخاص متى ضُبط — وإلا OSRM.
  const va = await valhallaTrip(origin, destination)
  if (va) {
    const result: RoutePath = {
      points: va.points,
      distanceKm: va.distanceKm,
      durationMin: va.durationMin,
    }
    pathCache.set(key, result)
    return result
  }
  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
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

/** خطوة ملاحة واحدة: تعليمة عربية + موقع المناورة + مسافتها + نوع المناورة (للسهم). */
export type NavStep = {
  instruction: string
  location: google.maps.LatLngLiteral
  distanceM: number
  /** نوع المناورة الخام من OSRM (turn/roundabout/arrive…) لاختيار السهم. */
  type: string
  /** اتجاه المناورة الخام (left/right/straight…) لاختيار السهم والنطق. */
  modifier?: string
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
  // ملاحة الكابتن (عالية الحجم) عبر Valhalla الخاص متى ضُبط — وإلا OSRM.
  const va = await valhallaTrip(origin, destination)
  if (va) {
    const steps: NavStep[] = va.maneuvers.map((m) => {
      const om = valhallaManeuver(m.type)
      const name = m.street_names?.[0] ?? ''
      const idx = Math.min(m.begin_shape_index ?? 0, va.points.length - 1)
      return {
        instruction: maneuverAr(om.type, om.modifier, name),
        location: va.points[Math.max(0, idx)] ?? destination,
        distanceM: (m.length ?? 0) * 1000,
        type: om.type,
        modifier: om.modifier,
      }
    })
    return { points: va.points, steps, distanceKm: va.distanceKm, durationMin: va.durationMin }
  }
  try {
    const url =
      `${OSRM_BASE_URL}/route/v1/driving/` +
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
          type: s.maneuver.type,
          modifier: s.maneuver.modifier,
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
