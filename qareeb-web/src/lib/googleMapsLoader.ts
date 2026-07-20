import { GOOGLE_MAPS_API_KEY } from './maps'

/**
 * محمّل Google Maps JavaScript API — يحقن السكربت مرّة واحدة ويعيد وعداً
 * ينحلّ عند جاهزية google.maps. يعمل داخل الـWebView (عميل/كابتن) والويب (أدمن)،
 * فيعرض بلاطات قوقل الحقيقية بلا مشكلة الطبقة الأصلية (SurfaceView).
 */

let promise: Promise<typeof google.maps> | null = null

export function loadGoogleMaps(): Promise<typeof google.maps> {
  if (typeof window === 'undefined') return Promise.reject(new Error('no window'))
  const w = window as unknown as { google?: { maps?: typeof google.maps } }
  if (w.google?.maps) return Promise.resolve(w.google.maps)
  if (promise) return promise

  promise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error('مفتاح خرائط قوقل غير مضبوط'))
      return
    }
    const cbName = '__qareebGmapsReady'
    ;(window as unknown as Record<string, unknown>)[cbName] = () => {
      resolve((window as unknown as { google: { maps: typeof google.maps } }).google.maps)
    }
    const s = document.createElement('script')
    s.src =
      `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}` +
      `&callback=${cbName}&language=ar&region=SD&loading=async&libraries=places`
    s.async = true
    s.defer = true
    s.onerror = () => {
      promise = null
      reject(new Error('تعذّر تحميل خرائط قوقل'))
    }
    document.head.appendChild(s)
  })
  return promise
}
