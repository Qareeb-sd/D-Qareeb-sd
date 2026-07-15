import { useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { KHARTOUM } from '@/theme'
import { GOOGLE_MAPS_API_KEY } from '@/lib/maps'
import { acquireMapTransparency, releaseMapTransparency } from '@/lib/nativeMapHost'
import LeafletMap from './LeafletMap'
import GoogleJsMap from './GoogleJsMap'

/**
 * خريطة التطبيق — مسارَان:
 *  • على الجهاز (Android): محرّك خرائط قوقل **الأصلي** (@capacitor/google-maps).
 *    يُرسم أصلاً خارج الـWebView فيعطي نفس جودة تطبيقات المنافسين، ويعمل داخل
 *    السودان (بعكس بلاطات قوقل داخل الـWebView التي كانت تظهر فارغة).
 *  • على الويب (لوحة الأدمن/التطوير): محرّك Leaflet (OpenStreetMap) بلا مفتاح.
 *
 * الواجهة نفسها في الحالتين: center/marker/driver/markers/driverMarkers/zoom/أحداث.
 * الدبوس المركزي (MapPin) واللوحة السفلية تُرسم فوق الخريطة داخل الـWebView.
 */

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  marker?: google.maps.LatLngLiteral
  /** موقع السائق المباشر — يُعرض بأيقونة سيارة/تلوين أخضر. */
  driver?: google.maps.LatLngLiteral
  /** علامات متعددة (نقاط انطلاق الرحلات في لوحة الأدمن). */
  markers?: google.maps.LatLngLiteral[]
  /** مواقع سائقين متعددة. */
  driverMarkers?: google.maps.LatLngLiteral[]
  /** خطّ مسار القيادة (للملاحة الحيّة أثناء الرحلة). */
  route?: google.maps.LatLngLiteral[]
  zoom?: number
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  /** يُستدعى عند سحب المستخدم للخريطة فعلياً (تفاعل حقيقي). */
  onUserDrag?: () => void
  className?: string
}

const isNative = Capacitor.isNativePlatform()
// خرائط قوقل عبر JavaScript API (GoogleJsMap) هي الافتراضية متى توفّر المفتاح —
// تُرسم داخل الـWebView فتعرض بلاطات قوقل الحقيقية بلا مشكلة الطبقة الأصلية.
// بلا مفتاح → Leaflet/CARTO. الطبقة الأصلية تبقى خياراً صريحاً (VITE_USE_NATIVE_MAPS=1).
const hasGoogleKey = Boolean(GOOGLE_MAPS_API_KEY)
const nativeEnabled = import.meta.env.VITE_USE_NATIVE_MAPS === '1'
const useNative = isNative && nativeEnabled && hasGoogleKey
const useGoogleJs = !useNative && hasGoogleKey

/** شارة تشخيص مؤقتة — تُظهر سبب عدم ظهور الخريطة الأصلية من لقطة واحدة. */
function DiagBadge({ text, tone }: { text: string; tone: 'ok' | 'warn' | 'err' }) {
  const bg = tone === 'ok' ? '#0F7B3F' : tone === 'warn' ? '#B07E00' : '#C1121F'
  return (
    <div
      dir="ltr"
      className="pointer-events-none absolute left-1 top-1 z-[600] rounded px-1.5 py-0.5 text-[10px] font-bold text-white"
      style={{ backgroundColor: bg, maxWidth: '90%' }}
    >
      {text}
    </div>
  )
}

export default function MapView(props: MapViewProps) {
  // الأولوية: قوقل JS (متى وُجد المفتاح) ← ثم Leaflet ← والأصلية عند الطلب الصريح.
  if (useNative) return <NativeGoogleMap {...props} />
  if (useGoogleJs) return <GoogleJsMap {...props} />
  return <LeafletMap {...props} />
}

/* ------------------------------ الخريطة الأصلية ------------------------------ */

type GMap = import('@capacitor/google-maps').GoogleMap
const DRIVER_TINT = { r: 15, g: 123, b: 63, a: 1 } // أخضر قريب

function NativeGoogleMap({
  center = KHARTOUM,
  marker,
  driver,
  markers,
  driverMarkers,
  route,
  zoom = 14,
  onCenterChanged,
  onUserDrag,
  className = 'h-64 w-full rounded-2xl',
}: MapViewProps) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GMap | null>(null)
  const markerIds = useRef<string[]>([])
  const polylineIds = useRef<string[]>([])
  // آخر مركز عرفته الكاميرا — لتفادي حلقة setCamera↔onCameraIdle.
  const lastCam = useRef<google.maps.LatLngLiteral>(center)
  const cbRef = useRef({ onCenterChanged, onUserDrag })
  cbRef.current = { onCenterChanged, onUserDrag }

  const [status, setStatus] = useState<'creating' | 'ready' | 'error'>('creating')
  const [errMsg, setErrMsg] = useState('')
  const [diag, setDiag] = useState('')

  // إنشاء الخريطة مرّة واحدة.
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    let cancelled = false
    let created: GMap | null = null

    void (async () => {
      try {
        const { GoogleMap } = await import('@capacitor/google-maps')
        if (cancelled) return
        acquireMapTransparency()
        const r = el.getBoundingClientRect()
        const hasCls = document.documentElement.classList.contains('native-map-open')
        setDiag(`cls:${hasCls ? 'Y' : 'N'} ${Math.round(r.width)}x${Math.round(r.height)}`)
        const map = await GoogleMap.create({
          id: `qareeb-map-${Math.round(el.getBoundingClientRect().top)}-${el.offsetWidth}`,
          element: el,
          apiKey: GOOGLE_MAPS_API_KEY,
          config: {
            center: { lat: center.lat, lng: center.lng },
            zoom,
            styles: [
              { featureType: 'poi', stylers: [{ visibility: 'off' }] },
              { featureType: 'transit', stylers: [{ visibility: 'off' }] },
            ],
          },
        })
        if (cancelled) {
          await map.destroy()
          releaseMapTransparency()
          return
        }
        created = map
        mapRef.current = map
        lastCam.current = { lat: center.lat, lng: center.lng }

        await map.setOnCameraIdleListener((e) => {
          lastCam.current = { lat: e.latitude, lng: e.longitude }
          cbRef.current.onCenterChanged?.({ lat: e.latitude, lng: e.longitude })
        })
        await map.setOnCameraMoveStartedListener((e) => {
          if (e.isGesture) cbRef.current.onUserDrag?.()
        })
        await syncMarkers(map)
        await syncRoute(map)
        setStatus('ready')
      } catch (e) {
        setStatus('error')
        setErrMsg(e instanceof Error ? e.message : String(e))
      }
    })()

    return () => {
      cancelled = true
      markerIds.current = []
      polylineIds.current = []
      if (created) {
        void created.destroy()
        releaseMapTransparency()
      }
      mapRef.current = null
    }
    // إنشاء لمرة واحدة؛ التحديثات في التأثيرات أدناه.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تحديث المركز من الخارج (تخطّي إن كان قريباً من موضع الكاميرا الحالي).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const c = lastCam.current
    if (Math.abs(c.lat - center.lat) > 1e-6 || Math.abs(c.lng - center.lng) > 1e-6) {
      lastCam.current = { lat: center.lat, lng: center.lng }
      void map.setCamera({ coordinate: { lat: center.lat, lng: center.lng }, animate: true })
    }
  }, [center.lat, center.lng])

  // تحديث العلامات عند أي تغيّر.
  useEffect(() => {
    const map = mapRef.current
    if (map) void syncMarkers(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    marker?.lat,
    marker?.lng,
    driver?.lat,
    driver?.lng,
    JSON.stringify(markers ?? []),
    JSON.stringify(driverMarkers ?? []),
  ])

  // تحديث خطّ المسار (الملاحة الحيّة) عند تغيّره.
  useEffect(() => {
    const map = mapRef.current
    if (map) void syncRoute(map)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(route ?? [])])

  async function syncRoute(map: GMap) {
    if (polylineIds.current.length) {
      try {
        await map.removePolylines(polylineIds.current)
      } catch {
        /* قد تكون أُزيلت مع إعادة الإنشاء */
      }
      polylineIds.current = []
    }
    if (route && route.length > 1) {
      try {
        polylineIds.current = await map.addPolylines([
          { path: route, strokeColor: '#0E3B2E', strokeWeight: 5, geodesic: true },
        ])
      } catch {
        /* تجاهل فشل الخطّ — الخريطة تبقى صالحة */
      }
    }
  }

  async function syncMarkers(map: GMap) {
    if (markerIds.current.length) {
      try {
        await map.removeMarkers(markerIds.current)
      } catch {
        /* قد تكون أُزيلت مع إعادة الإنشاء */
      }
      markerIds.current = []
    }
    const toAdd: import('@capacitor/google-maps').Marker[] = []
    if (marker) toAdd.push({ coordinate: marker })
    markers?.forEach((m) => toAdd.push({ coordinate: m }))
    driverMarkers?.forEach((d) => toAdd.push({ coordinate: d, tintColor: DRIVER_TINT }))
    if (driver) toAdd.push({ coordinate: driver, tintColor: DRIVER_TINT })
    if (toAdd.length) {
      try {
        markerIds.current = await map.addMarkers(toAdd)
      } catch {
        /* تجاهل فشل العلامات — الخريطة تبقى صالحة */
      }
    }
  }

  // dir=ltr: تخطيط الخريطة يفترض LTR. الخلفيّة شفّافة لتظهر الخريطة الأصلية خلفها.
  // العنصر نفسه هو مرجع الخريطة (className يأتي من المستدعي: absolute inset-0)،
  // فلا نغلّفه حتى لا ينهار ارتفاعه إلى صفر. الشارات أبناء له.
  return (
    <div ref={divRef} dir="ltr" className={`overflow-hidden bg-transparent ${className}`}>
      {status === 'creating' && <DiagBadge text={`native creating… ${diag}`} tone="warn" />}
      {status === 'ready' && <DiagBadge text={`native READY ✓ ${diag}`} tone="ok" />}
      {status === 'error' && <DiagBadge text={`native ERROR: ${errMsg}`} tone="err" />}
    </div>
  )
}
