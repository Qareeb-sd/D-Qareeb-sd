import { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { KHARTOUM } from '@/theme'

/**
 * خريطة Leaflet + بلاطات OpenStreetMap — مجانية وبلا مفتاح، تُستخدم على الويب
 * (لوحة الأدمن والتطوير). على الجهاز نستخدم خريطة قوقل الأصلية (MapView).
 * الواجهة نفسها: center/marker/driver/markers/driverMarkers/zoom/أحداث.
 */

// أيقونة السائق: سيارة داخل دائرة خضراء (SVG مضمّن).
const carIcon = L.divIcon({
  className: '',
  html:
    `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46">` +
    `<circle cx="23" cy="23" r="18" fill="#0F7B3F" stroke="#fff" stroke-width="3"/>` +
    `<text x="23" y="30" font-size="20" text-anchor="middle">🚗</text></svg>`,
  iconSize: [46, 46],
  iconAnchor: [23, 23],
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
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '© OpenStreetMap',
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
  ])

  return <div ref={divRef} dir="ltr" className={`overflow-hidden ${className}`} />
}
