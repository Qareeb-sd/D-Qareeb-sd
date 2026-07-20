/**
 * تقرير ازدحام يوميّ لمدينة عبر Google Directions مع توقّع حركة المرور:
 * نقيس زمن مسار يعبر مركز المدينة عبر ساعات اليوم (departureTime مستقبليّ)
 * مقابل الزمن الطبيعي → نسبة ازدحام لكل ساعة (مقياس + منحنى خلال اليوم).
 * يُشغَّل عند الطلب فقط (زرّ) توفيراً للتكلفة. يتطلّب تفعيل «Directions API».
 */
import { loadGoogleMaps } from './googleMapsLoader'
import { GOOGLE_MAPS_API_KEY } from './maps'

export type TrafficLevel = 'light' | 'moderate' | 'heavy' | 'severe'

export const LEVEL_LABEL: Record<TrafficLevel, string> = {
  light: 'انسيابي',
  moderate: 'متوسّط',
  heavy: 'مزدحم',
  severe: 'متوقّف',
}
export const LEVEL_COLOR: Record<TrafficLevel, string> = {
  light: '#12A150',
  moderate: '#F59E0B',
  heavy: '#EF4444',
  severe: '#991B1B',
}

export function levelOf(ratio: number): TrafficLevel {
  if (ratio >= 1.7) return 'severe'
  if (ratio >= 1.4) return 'heavy'
  if (ratio >= 1.15) return 'moderate'
  return 'light'
}

/** ساعات القياس عبر اليوم (تقرير الأوقات الزمنية). */
export const DAY_HOURS = [6, 8, 10, 12, 14, 16, 18, 20]

export interface DaySlot {
  hour: number
  ratio: number // زمن-مع-الزحمة ÷ الزمن-الطبيعي
  level: TrafficLevel
}

/** أقرب وقت مستقبليّ عند الساعة hour (اليوم أو الغد) — لتوقّع قوقل. */
function nextAt(hour: number): Date {
  const now = new Date()
  const d = new Date(now)
  d.setHours(hour, 0, 0, 0)
  if (d.getTime() <= now.getTime()) d.setDate(d.getDate() + 1)
  return d
}

async function routeRatio(
  ds: google.maps.DirectionsService,
  maps: typeof google.maps,
  center: google.maps.LatLngLiteral,
  departureTime: Date,
): Promise<number | null> {
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
        resolve(traf / base)
      },
    )
  })
}

/** تقرير ازدحام مدينة واحدة عبر ساعات اليوم (نسبة لكل ساعة). [] إن لا مفتاح. */
export async function fetchDayReport(center: google.maps.LatLngLiteral): Promise<DaySlot[]> {
  if (!GOOGLE_MAPS_API_KEY) return []
  const maps = await loadGoogleMaps()
  const ds = new maps.DirectionsService()
  const out: DaySlot[] = []
  for (const h of DAY_HOURS) {
    const r = await routeRatio(ds, maps, center, nextAt(h))
    if (r != null) out.push({ hour: h, ratio: r, level: levelOf(r) })
  }
  return out
}
