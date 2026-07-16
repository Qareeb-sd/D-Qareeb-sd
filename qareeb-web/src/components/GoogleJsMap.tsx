import { useEffect, useRef } from 'react'
import { KHARTOUM } from '@/theme'
import { loadGoogleMaps } from '@/lib/googleMapsLoader'

/**
 * خريطة Google Maps عبر JavaScript API — تُرسم داخل الـWebView (طبقة الويب)،
 * فتعرض بلاطات قوقل الحقيقية على العميل/الكابتن والأدمن بلا مشكلة الطبقة الأصلية.
 * الواجهة نفسها: center/marker/driver/markers/driverMarkers/route/zoom/أحداث.
 */

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  marker?: google.maps.LatLngLiteral
  driver?: google.maps.LatLngLiteral
  markers?: google.maps.LatLngLiteral[]
  driverMarkers?: google.maps.LatLngLiteral[]
  route?: google.maps.LatLngLiteral[]
  zoom?: number
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  onUserDrag?: () => void
  className?: string
}

// أيقونة السائق (سيارة داخل شارة زمردية) — نفس هوية «الواحة».
const CAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">` +
  `<defs><filter id="cs" x="-30%" y="-30%" width="160%" height="160%">` +
  `<feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#0E3B2E" flood-opacity="0.35"/></filter></defs>` +
  `<circle cx="28" cy="28" r="21" fill="#0E3B2E" stroke="#fff" stroke-width="3.5" filter="url(#cs)"/>` +
  `<g transform="translate(14.5,14.5) scale(1.12)" fill="#E8D9B6">` +
  `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/>` +
  `<path d="M6.5 6.5h11L19 11H5z" fill="#0E3B2E"/>` +
  `<circle cx="6.9" cy="14.6" r="1.7" fill="#0E3B2E"/><circle cx="17.1" cy="14.6" r="1.7" fill="#0E3B2E"/>` +
  `</g></svg>`

// أيقونة سيارة متصلة قريبة: سيارة بيضاء واضحة على قرص أخضر بإطار أبيض.
const NEARBY_CAR_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46" viewBox="0 0 46 46">` +
  `<defs><filter id="ncs" x="-40%" y="-40%" width="180%" height="180%">` +
  `<feDropShadow dx="0" dy="2" stdDeviation="2.2" flood-color="#0E3B2E" flood-opacity="0.4"/></filter></defs>` +
  `<circle cx="23" cy="23" r="17.5" fill="#1B6B3F" stroke="#fff" stroke-width="3" filter="url(#ncs)"/>` +
  `<g transform="translate(11,11)" fill="#fff">` +
  `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99zM6.5 16c-.83 0-1.5-.67-1.5-1.5S5.67 13 6.5 13s1.5.67 1.5 1.5S7.33 16 6.5 16zm11 0c-.83 0-1.5-.67-1.5-1.5s.67-1.5 1.5-1.5 1.5.67 1.5 1.5-.67 1.5-1.5 1.5zM5 11l1.5-4.5h11L19 11H5z"/>` +
  `</g></svg>`

const PIN_SVG =
  `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">` +
  `<path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0Z" fill="#E11D48"/>` +
  `<circle cx="15" cy="14.5" r="5.5" fill="#fff"/></svg>`

const svgUrl = (svg: string) => `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`

export default function GoogleJsMap({
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
  const mapRef = useRef<google.maps.Map | null>(null)
  const overlays = useRef<{ markers: google.maps.Marker[]; lines: google.maps.Polyline[] }>({
    markers: [],
    lines: [],
  })
  const lastCam = useRef<google.maps.LatLngLiteral>(center)
  const cbRef = useRef({ onCenterChanged, onUserDrag })
  cbRef.current = { onCenterChanged, onUserDrag }

  // إنشاء الخريطة مرّة واحدة.
  useEffect(() => {
    const el = divRef.current
    if (!el) return
    let cancelled = false

    void loadGoogleMaps()
      .then((maps) => {
        if (cancelled || !divRef.current) return
        const map = new maps.Map(divRef.current, {
          center,
          zoom,
          disableDefaultUI: true,
          clickableIcons: false,
          gestureHandling: 'greedy',
          styles: [
            { featureType: 'poi', stylers: [{ visibility: 'off' }] },
            { featureType: 'transit', stylers: [{ visibility: 'off' }] },
          ],
        })
        mapRef.current = map
        lastCam.current = center

        map.addListener('idle', () => {
          const c = map.getCenter()
          if (!c) return
          lastCam.current = { lat: c.lat(), lng: c.lng() }
          cbRef.current.onCenterChanged?.({ lat: c.lat(), lng: c.lng() })
        })
        map.addListener('dragstart', () => cbRef.current.onUserDrag?.())

        drawOverlays()
      })
      .catch(() => {
        /* بلا مفتاح/فشل تحميل — MapView سيعرض Leaflet بدلاً منها عبر شرط المفتاح */
      })

    return () => {
      cancelled = true
      overlays.current.markers.forEach((m) => m.setMap(null))
      overlays.current.lines.forEach((l) => l.setMap(null))
      overlays.current = { markers: [], lines: [] }
      mapRef.current = null
    }
    // إنشاء لمرة واحدة.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // تحديث المركز من الخارج (تفادي حلقة idle↔setCenter).
  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const c = lastCam.current
    if (Math.abs(c.lat - center.lat) > 1e-6 || Math.abs(c.lng - center.lng) > 1e-6) {
      lastCam.current = center
      map.panTo(center)
    }
  }, [center.lat, center.lng])

  // تحديث العلامات والمسار.
  useEffect(() => {
    if (mapRef.current) drawOverlays()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    marker?.lat,
    marker?.lng,
    driver?.lat,
    driver?.lng,
    JSON.stringify(markers ?? []),
    JSON.stringify(driverMarkers ?? []),
    JSON.stringify(route ?? []),
  ])

  function drawOverlays() {
    const map = mapRef.current
    const maps = (window as unknown as { google?: { maps?: typeof google.maps } }).google?.maps
    if (!map || !maps) return

    overlays.current.markers.forEach((m) => m.setMap(null))
    overlays.current.lines.forEach((l) => l.setMap(null))
    overlays.current = { markers: [], lines: [] }

    // خطّ المسار: هالة بيضاء ثم خطّ زمردي فوقها.
    if (route && route.length > 1) {
      overlays.current.lines.push(
        new maps.Polyline({ path: route, map, strokeColor: '#ffffff', strokeWeight: 8, strokeOpacity: 0.9 }),
        new maps.Polyline({ path: route, map, strokeColor: '#0E3B2E', strokeWeight: 4.5, strokeOpacity: 0.95 }),
      )
    }

    const pinIcon = {
      url: svgUrl(PIN_SVG),
      scaledSize: new maps.Size(30, 42),
      anchor: new maps.Point(15, 42),
    }
    const carIcon = {
      url: svgUrl(CAR_SVG),
      scaledSize: new maps.Size(56, 56),
      anchor: new maps.Point(28, 28),
    }
    const nearbyCarIcon = {
      url: svgUrl(NEARBY_CAR_SVG),
      scaledSize: new maps.Size(44, 44),
      anchor: new maps.Point(22, 22),
    }

    const add = (pos: google.maps.LatLngLiteral, icon: google.maps.Icon, z: number) =>
      overlays.current.markers.push(new maps.Marker({ position: pos, map, icon, zIndex: z }))

    if (marker) add(marker, pinIcon, 10)
    markers?.forEach((m) => add(m, pinIcon, 10))
    driverMarkers?.forEach((d) => add(d, nearbyCarIcon, 500))
    if (driver) add(driver, carIcon, 1000)
  }

  return <div ref={divRef} dir="ltr" className={`overflow-hidden ${className}`} />
}
