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
  styles: [
    { featureType: 'poi', stylers: [{ visibility: 'off' }] },
    { featureType: 'transit', stylers: [{ visibility: 'off' }] },
  ],
}

/**
 * مسافة وزمن الطريق الفعليان عبر Google Directions API.
 * يرجّع null إذا لم تُحمّل الخريطة أو فشل الطلب (فيُستخدم بديل Haversine).
 */
export async function fetchRoute(
  origin: google.maps.LatLngLiteral,
  destination: google.maps.LatLngLiteral,
): Promise<{ distanceKm: number; durationMin: number } | null> {
  if (typeof google === 'undefined' || !google.maps?.DirectionsService) return null
  try {
    const svc = new google.maps.DirectionsService()
    const res = await svc.route({
      origin,
      destination,
      travelMode: google.maps.TravelMode.DRIVING,
    })
    const leg = res.routes[0]?.legs[0]
    if (!leg?.distance || !leg?.duration) return null
    return {
      distanceKm: leg.distance.value / 1000,
      durationMin: leg.duration.value / 60,
    }
  } catch {
    return null
  }
}
