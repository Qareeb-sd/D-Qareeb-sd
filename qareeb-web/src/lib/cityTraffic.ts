/**
 * مؤشّر ازدحام لكل مدينة **حسب الوقت** عبر Google Directions مع توقّع حركة المرور:
 * نقيس زمن مسار يعبر مركز المدينة في ٣ فترات (صباح/ظهر/مساء) باستخدام
 * departureTime مستقبليّ (توقّع قوقل) مقابل الزمن الطبيعي → نسبة ازدحام لكل فترة.
 * يُشغَّل عند الطلب فقط (زرّ) توفيراً للتكلفة. يتطلّب تفعيل «Directions API».
 */
import { loadGoogleMaps } from './googleMapsLoader'
import { GOOGLE_MAPS_API_KEY } from './maps'

export type TrafficLevel = 'light' | 'moderate' | 'heavy'
export type Period = 'morning' | 'afternoon' | 'evening'

export const PERIODS: Period[] = ['morning', 'afternoon', 'evening']
export const PERIOD_HOUR: Record<Period, number> = { morning: 8, afternoon: 15, evening: 20 }
export const PERIOD_LABEL: Record<Period, string> = {
  morning: 'ص',
  afternoon: 'ظ',
  evening: 'م',
}
export const LEVEL_DOT: Record<TrafficLevel, string> = {
  light: '🟢',
  moderate: '🟠',
  heavy: '🔴',
}

/** مستوى الازدحام لكل فترة قِيست. */
export type CityTraffic = Partial<Record<Period, TrafficLevel>>

function levelOf(ratio: number): TrafficLevel {
  if (ratio >= 1.4) return 'heavy'
  if (ratio >= 1.15) return 'moderate'
  return 'light'
}

/** أقرب وقت مستقبليّ عند الساعة hour (اليوم أو الغد) — لتوقّع قوقل. */
function nextAt(hour: number): Date {
  const now = new Date()
  const d = new Date(now)
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  return d
}

async function routeLevel(
  ds: google.maps.DirectionsService,
  maps: typeof google.maps,
  center: google.maps.LatLngLiteral,
  departureTime: Date,
): Promise<TrafficLevel | null> {
  const origin = { lat: center.lat - 0.03, lng: center.lng - 0.03 }
  const destination = { lat: center.lat + 0.03, lng: center.lng + 0.03 }
  return new Promise((resolve) => {
    ds.route(
      {
        origin,
        destination,
        travelMode: maps.TravelMode.DRIVING,
        drivingOptions: { departureTime, trafficModel: maps.TrafficModel.BEST_GUESS },
      },
      (res, status) => {
        if (status !== maps.DirectionsStatus.OK || !res) return resolve(null)
        const leg = res.routes[0]?.legs[0]
        const base = leg?.duration?.value
        const traf = leg?.duration_in_traffic?.value ?? base
        if (!base || !traf) return resolve(null)
        resolve(levelOf(traf / base))
      },
    )
  })
}

/** يقيس ازدحام قائمة مدن في ٣ فترات (تسلسليّاً). {} إن لا مفتاح. */
export async function fetchCityTraffic(
  list: { id: string; center: google.maps.LatLngLiteral }[],
): Promise<Record<string, CityTraffic>> {
  if (!GOOGLE_MAPS_API_KEY) return {}
  const maps = await loadGoogleMaps()
  const ds = new maps.DirectionsService()
  const out: Record<string, CityTraffic> = {}
  for (const c of list) {
    const t: CityTraffic = {}
    for (const p of PERIODS) {
      const lvl = await routeLevel(ds, maps, c.center, nextAt(PERIOD_HOUR[p]))
      if (lvl) t[p] = lvl
    }
    if (Object.keys(t).length) out[c.id] = t
  }
  return out
}
