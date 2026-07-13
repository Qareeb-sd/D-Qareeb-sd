import { Capacitor } from '@capacitor/core'

/**
 * تحديد الموقع — يستخدم @capacitor/geolocation الأصلي على الجهاز (يطلب الإذن
 * ويعمل بموثوقية بعكس navigator.geolocation داخل WebView)، ويعود لواجهة الويب
 * في المتصفح/الأدمن. يُستخدم لتتبّع موقع السائق وتحديد موقع العميل.
 */
export interface GeoPos {
  lat: number
  lng: number
}

const isNative = Capacitor.isNativePlatform()

/** موقع واحد فوري (يعيد null إن تعذّر/رُفض الإذن). */
export async function getCurrentPos(): Promise<GeoPos | null> {
  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      const perm = await Geolocation.requestPermissions()
      if (perm.location === 'denied' && perm.coarseLocation === 'denied') return null
      const p = await Geolocation.getCurrentPosition({ enableHighAccuracy: true, timeout: 10000 })
      return { lat: p.coords.latitude, lng: p.coords.longitude }
    } catch {
      return null
    }
  }
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 8000 },
    )
  })
}

/** تتبّع الموقع المستمر — يعيد دالة إيقاف. */
export async function watchPos(cb: (p: GeoPos) => void): Promise<() => void> {
  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      await Geolocation.requestPermissions()
      const id = await Geolocation.watchPosition(
        { enableHighAccuracy: true, timeout: 15000 },
        (p) => {
          if (p) cb({ lat: p.coords.latitude, lng: p.coords.longitude })
        },
      )
      return () => {
        void Geolocation.clearWatch({ id })
      }
    } catch {
      /* يسقط لواجهة الويب */
    }
  }
  if (!('geolocation' in navigator)) return () => {}
  const wid = navigator.geolocation.watchPosition(
    (p) => cb({ lat: p.coords.latitude, lng: p.coords.longitude }),
    undefined,
    { enableHighAccuracy: true, maximumAge: 5000, timeout: 15000 },
  )
  return () => navigator.geolocation.clearWatch(wid)
}
