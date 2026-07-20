/**
 * مؤشّر ازدحام لكل مدينة عبر Google Directions مع حركة المرور الحيّة:
 * نقيس زمن مسار تمثيلي يعبر مركز المدينة الآن (duration_in_traffic) مقابل
 * الزمن الطبيعي (duration) → نسبة الازدحام. يُشغَّل عند الطلب فقط (زرّ) توفيراً
 * للتكلفة. يتطلّب تفعيل «Directions API» على مفتاح قوقل.
 */
import { loadGoogleMaps } from './googleMapsLoader'
import { GOOGLE_MAPS_API_KEY } from './maps'

export type TrafficLevel = 'light' | 'moderate' | 'heavy'
export interface CityTraffic {
  ratio: number // زمن-مع-الزحمة ÷ الزمن-الطبيعي
  level: TrafficLevel
}
export const TRAFFIC_LABEL: Record<TrafficLevel, string> = {
  light: '🟢 انسيابي',
  moderate: '🟠 متوسّط',
  heavy: '🔴 مزدحم',
}

function levelOf(ratio: number): TrafficLevel {
  if (ratio >= 1.4) return 'heavy'
  if (ratio >= 1.15) return 'moderate'
  return 'light'
}

/** يقيس ازدحام مسار قصير يعبر مركز المدينة (~٥ كم قطرياً). */
async function routeTraffic(
  ds: google.maps.DirectionsService,
  maps: typeof google.maps,
  center: google.maps.LatLngLiteral,
): Promise<CityTraffic | null> {
  const origin = { lat: center.lat - 0.03, lng: center.lng - 0.03 }
  const destination = { lat: center.lat + 0.03, lng: center.lng + 0.03 }
  return new Promise((resolve) => {
    ds.route(
      {
        origin,
        destination,
        travelMode: maps.TravelMode.DRIVING,
        drivingOptions: { departureTime: new Date(), trafficModel: maps.TrafficModel.BEST_GUESS },
      },
      (res, status) => {
        if (status !== maps.DirectionsStatus.OK || !res) return resolve(null)
        const leg = res.routes[0]?.legs[0]
        const base = leg?.duration?.value
        const traf = leg?.duration_in_traffic?.value ?? base
        if (!base || !traf) return resolve(null)
        resolve({ ratio: traf / base, level: levelOf(traf / base) })
      },
    )
  })
}

/** يقيس ازدحام قائمة مدن (تسلسليّاً لتفادي حدود المعدّل). {} إن لا مفتاح. */
export async function fetchCityTraffic(
  list: { id: string; center: google.maps.LatLngLiteral }[],
): Promise<Record<string, CityTraffic>> {
  if (!GOOGLE_MAPS_API_KEY) return {}
  const maps = await loadGoogleMaps()
  const ds = new maps.DirectionsService()
  const out: Record<string, CityTraffic> = {}
  for (const c of list) {
    const t = await routeTraffic(ds, maps, c.center)
    if (t) out[c.id] = t
  }
  return out
}
