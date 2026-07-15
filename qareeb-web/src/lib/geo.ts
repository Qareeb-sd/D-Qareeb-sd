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

// آخر موقع ناجح — يُحفظ محلياً ليصبح المركز الافتراضي (بدل الخرطوم) في المرّة
// التالية، فلا يعود التطبيق «للسودان» بعد أوّل تحديد صحيح.
const LAST_POS_KEY = 'qareeb_last_pos'
export function saveLastPos(p: GeoPos): void {
  try {
    localStorage.setItem(LAST_POS_KEY, JSON.stringify(p))
  } catch {
    /* التخزين المحلي غير متاح */
  }
}
export function loadLastPos(): GeoPos | null {
  try {
    const s = localStorage.getItem(LAST_POS_KEY)
    const p = s ? (JSON.parse(s) as GeoPos) : null
    return p && typeof p.lat === 'number' && typeof p.lng === 'number' ? p : null
  } catch {
    return null
  }
}

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
      // الدقّة أولاً: نراقب بدقّة عالية ونحتفظ بأفضل قراءة (أدقّها)، ونتوقّف مبكراً
      // متى بلغت دقّة جيّدة (≤ 40م) وإلا نُعيد الأفضل بعد مهلة قصوى. هذا يتجنّب
      // موقع الشبكة/المُخزَّن الخاطئ الذي قد يبعد كيلومترات.
      // حاجز الدقّة: نقبل قراءات GPS الحقيقية فقط (≤ 150م) ونرفض موقع الشبكة
      // التقريبي (قد يبعد كيلومترات/بلداناً مع شريحة أجنبية). إن لم نحصل على قراءة
      // دقيقة خلال المهلة → null (فيحدّد المستخدم يدوياً على الخريطة).
      const ACCEPT_M = 2000
      return await new Promise<GeoPos | null>((resolve) => {
        let best: { lat: number; lng: number; acc: number } | null = null
        let done = false
        let watchId = ''
        const finish = () => {
          if (done) return
          done = true
          clearTimeout(timer)
          if (watchId) void Geolocation.clearWatch({ id: watchId })
          const result = best && best.acc <= ACCEPT_M ? { lat: best.lat, lng: best.lng } : null
          if (result) saveLastPos(result)
          resolve(result)
        }
        const timer = setTimeout(finish, 15000)
        void Geolocation.watchPosition({ enableHighAccuracy: true, timeout: 15000 }, (p) => {
          if (!p) return
          const acc = p.coords.accuracy ?? 9999
          if (!best || acc < best.acc) {
            best = { lat: p.coords.latitude, lng: p.coords.longitude, acc }
          }
          if (acc <= 40) finish() // دقّة ممتازة — توقّف مبكراً
        }).then((id) => {
          watchId = id
          if (done) void Geolocation.clearWatch({ id })
        })
      })
    } catch {
      return null
    }
  }
  return new Promise((resolve) => {
    if (!('geolocation' in navigator)) return resolve(null)
    // دقّة عالية لموقع صحيح (بلا موقع مُخزَّن قديم).
    navigator.geolocation.getCurrentPosition(
      (p) => {
        const r = { lat: p.coords.latitude, lng: p.coords.longitude }
        saveLastPos(r)
        resolve(r)
      },
      () => resolve(null),
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
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
