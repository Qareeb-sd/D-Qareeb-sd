import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { KHARTOUM } from '@/theme'

/**
 * خريطة Leaflet + بلاطات OpenStreetMap — مجانية وبلا مفتاح، تُستخدم على الويب
 * (لوحة الأدمن والتطوير). على الجهاز نستخدم خريطة قوقل الأصلية (MapView).
 * الواجهة نفسها: center/marker/driver/markers/driverMarkers/zoom/أحداث.
 */

// أيقونة السائق: سيارة واضحة داخل شارة زمردية كبيرة بظلّ — بلا إيموجي، هوية «الواحة».
const carIcon = L.divIcon({
  className: '',
  html:
    `<svg xmlns="http://www.w3.org/2000/svg" width="56" height="56" viewBox="0 0 56 56">` +
    `<defs><filter id="cs" x="-30%" y="-30%" width="160%" height="160%">` +
    `<feDropShadow dx="0" dy="2" stdDeviation="2.4" flood-color="#0E3B2E" flood-opacity="0.35"/></filter></defs>` +
    `<circle cx="28" cy="28" r="21" fill="#0E3B2E" stroke="#fff" stroke-width="3.5" filter="url(#cs)"/>` +
    `<g transform="translate(14.5,14.5) scale(1.12)" fill="#E8D9B6">` +
    `<path d="M18.92 6.01C18.72 5.42 18.16 5 17.5 5h-11c-.66 0-1.21.42-1.42 1.01L3 12v8c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-1h12v1c0 .55.45 1 1 1h1c.55 0 1-.45 1-1v-8l-2.08-5.99z"/>` +
    `<path d="M6.5 6.5h11L19 11H5z" fill="#0E3B2E"/>` +
    `<circle cx="6.9" cy="14.6" r="1.7" fill="#0E3B2E"/><circle cx="17.1" cy="14.6" r="1.7" fill="#0E3B2E"/>` +
    `</g></svg>`,
  iconSize: [56, 56],
  iconAnchor: [28, 28],
})

// دبوس موقع (أحمر) للعلامات الثابتة.
const pinIcon = L.divIcon({
  className: '',
  html:
    `<svg xmlns="http://www.w3.org/2000/svg" width="30" height="42" viewBox="0 0 30 42">` +
    `<path d="M15 0C6.7 0 0 6.6 0 14.8 0 25.9 15 42 15 42s15-16.1 15-27.2C30 6.6 23.3 0 15 0Z" fill="#E11D48"/>` +
    `<circle cx="15" cy="14.5" r="5.5" fill="#fff"/></svg>`,
  iconSize: [30, 42],
  iconAnchor: [15, 42],
})

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  marker?: google.maps.LatLngLiteral
  driver?: google.maps.LatLngLiteral
  markers?: google.maps.LatLngLiteral[]
  driverMarkers?: google.maps.LatLngLiteral[]
  /** خطّ مسار القيادة (للملاحة الحيّة أثناء الرحلة). */
  route?: google.maps.LatLngLiteral[]
  zoom?: number
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  onUserDrag?: () => void
  className?: string
}

export default function LeafletMap({
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
  const mapRef = useRef<L.Map | null>(null)
  const layerRef = useRef<L.LayerGroup | null>(null)

  const cbRef = useRef({ onCenterChanged, onUserDrag })
  cbRef.current = { onCenterChanged, onUserDrag }

  useEffect(() => {
    const el = divRef.current
    if (!el || mapRef.current) return

    const map = L.map(el, {
      center: [center.lat, center.lng],
      zoom,
      zoomControl: false,
      attributionControl: true,
    })
    // بلاطات CARTO Voyager: مظهر ملوّن نظيف قريب من خرائط قوقل (شوارع ملوّنة،
    // معالم، خطوط واضحة) — مجانية بلا مفتاح وتصل من داخل السودان، وأجمل بكثير
    // من بلاطات OSM الخام. subdomains a–d لتوزيع الحمل وسرعة أعلى.
    L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
      subdomains: 'abcd',
      maxZoom: 20,
      attribution: '© OpenStreetMap © CARTO',
    }).addTo(map)
    layerRef.current = L.layerGroup().addTo(map)

    map.on('moveend', () => {
      const c = map.getCenter()
      cbRef.current.onCenterChanged?.({ lat: c.lat, lng: c.lng })
    })
    map.on('dragend', () => cbRef.current.onUserDrag?.())

    mapRef.current = map

    const ro = new ResizeObserver(() => map.invalidateSize())
    ro.observe(el)
    setTimeout(() => map.invalidateSize(), 0)

    return () => {
      ro.disconnect()
      map.remove()
      mapRef.current = null
      layerRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const c = map.getCenter()
    if (Math.abs(c.lat - center.lat) > 1e-7 || Math.abs(c.lng - center.lng) > 1e-7) {
      map.setView([center.lat, center.lng], map.getZoom() || zoom)
    }
  }, [center.lat, center.lng, zoom])

  useEffect(() => {
    const layer = layerRef.current
    if (!layer) return
    layer.clearLayers()
    // خطّ المسار أولاً (أسفل العلامات): هالة بيضاء ثم خطّ زمردي.
    if (route && route.length > 1) {
      const pts = route.map((p) => [p.lat, p.lng] as [number, number])
      L.polyline(pts, { color: '#ffffff', weight: 8, opacity: 0.9 }).addTo(layer)
      L.polyline(pts, { color: '#0E3B2E', weight: 4.5, opacity: 0.95 }).addTo(layer)
    }
    if (marker) L.marker([marker.lat, marker.lng], { icon: pinIcon }).addTo(layer)
    markers?.forEach((m) => L.marker([m.lat, m.lng], { icon: pinIcon }).addTo(layer))
    driverMarkers?.forEach((d) =>
      L.marker([d.lat, d.lng], { icon: carIcon, zIndexOffset: 500 }).addTo(layer),
    )
    if (driver)
      L.marker([driver.lat, driver.lng], { icon: carIcon, zIndexOffset: 1000 }).addTo(layer)
  }, [
    marker?.lat,
    marker?.lng,
    driver?.lat,
    driver?.lng,
    JSON.stringify(markers ?? []),
    JSON.stringify(driverMarkers ?? []),
    JSON.stringify(route ?? []),
  ])

  return <div ref={divRef} dir="ltr" className={`overflow-hidden ${className}`} />
}
