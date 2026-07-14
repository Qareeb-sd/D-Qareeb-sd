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

/** يطلب إذن الموقع مبكراً (بلا جلب موقع) — لتجهيزه قبل بدء الرحلة. */
export async function ensureGeoPermission(): Promise<void> {
  if (!isNative) return
  try {
    const { Geolocation } = await import('@capacitor/geolocation')
    await Geolocation.requestPermissions()
  } catch {
    /* تجاهل */
  }
}

/** موقع واحد فوري (يعيد null إن تعذّر/رُفض الإذن). */
export async function getCurrentPos(): Promise<GeoPos | null> {
  if (isNative) {
    try {
      const { Geolocation } = await import('@capacitor/geolocation')
      let perm = await Geolocation.checkPermissions()
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') {
        perm = await Geolocation.requestPermissions()
      }
      if (perm.location !== 'granted' && perm.coarseLocation !== 'granted') return null
      // للسرعة: محاولة سريعة (شبكة/موقع مُخزَّن) أولاً — تُرجع فوراً تقريباً —
      // ثم دقّة عالية إن فشلت المحاولة السريعة. الدبوس قابل للضبط فالتقريب يكفي.
      try {
        const p = await Geolocation.getCurrentPosition({
          enableHighAccuracy: false,
          timeout: 6000,
          maximumAge: 60000,
        })
        return { lat: p.coords.latitude, lng: p.coords.longitude }
      } catch {
        const p = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 12000,
          maximumAge: 30000,
        })
        return { lat: p.coords.latitude, lng: p.coords.longitude }
      }
    } catch {
      return null
    }
  }
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    // محاولة سريعة أولاً (منخفضة الدقّة/مُخزَّنة)، ثم دقّة عالية عند الفشل.
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      () =>
        navigator.geolocation.getCurrentPosition(
          (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
          () => resolve(null),
          { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 },
        ),
      { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 },
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
