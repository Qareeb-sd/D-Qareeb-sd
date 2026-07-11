import { useEffect, useRef } from 'react'
import { Capacitor } from '@capacitor/core'
import { KHARTOUM } from '@/theme'
import { GOOGLE_MAPS_API_KEY } from '@/lib/maps'
import { acquireMapTransparency, releaseMapTransparency } from '@/lib/nativeMapHost'
import LeafletMap from './LeafletMap'

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
  zoom?: number
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  /** يُستدعى عند سحب المستخدم للخريطة فعلياً (تفاعل حقيقي). */
  onUserDrag?: () => void
  className?: string
}

const useNative = Capacitor.isNativePlatform() && Boolean(GOOGLE_MAPS_API_KEY)

export default function MapView(props: MapViewProps) {
  // على الويب: نستخدم Leaflet مباشرة.
  if (!useNative) return <LeafletMap {...props} />
  return <NativeGoogleMap {...props} />
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
  zoom = 14,
  onCenterChanged,
  onUserDrag,
  className = 'h-64 w-full rounded-2xl',
}: MapViewProps) {
  const divRef = useRef<HTMLDivElement | null>(null)
  const mapRef = useRef<GMap | null>(null)
  const markerIds = useRef<string[]>([])
  // آخر مركز عرفته الكاميرا — لتفادي حلقة setCamera↔onCameraIdle.
  const lastCam = useRef<google.maps.LatLngLiteral>(center)
  const cbRef = useRef({ onCenterChanged, onUserDrag })
  cbRef.current = { onCenterChanged, onUserDrag }

  // إنشاء الخريطة مرّة واحدة.
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    let cancelled = false
    let created: GMap | null = null

    void (async () => {
      const { GoogleMap } = await import('@capacitor/google-maps')
      if (cancelled) return
      acquireMapTransparency()
      const map = await GoogleMap.create({
        id: `qareeb-map-${Math.round(el.getBoundingClientRect().top)}-${el.offsetWidth}`,
        element: el,
        apiKey: GOOGLE_MAPS_API_KEY,
        config: {
          center: { lat: center.lat, lng: center.lng },
          zoom,
          // مظهر نظيف: إخفاء نقاط الاهتمام والمواصلات (مطابق لهوية "قريب").
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
    })()

    return () => {
      cancelled = true
      markerIds.current = []
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
  return (
    <div
      ref={divRef}
      dir="ltr"
      className={`overflow-hidden bg-transparent ${className}`}
    />
  )
}
