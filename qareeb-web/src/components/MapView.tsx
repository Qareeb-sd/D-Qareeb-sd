import { useRef } from 'react'
import { useJsApiLoader, GoogleMap, MarkerF, PolylineF } from '@react-google-maps/api'
import {
  GOOGLE_MAPS_API_KEY,
  MAPS_LIBRARIES,
  MAPS_LOADER_ID,
  MAP_OPTIONS,
  isMapsConfigured,
} from '@/lib/maps'
import { KHARTOUM } from '@/theme'

// أيقونة السائق (سيارة داخل دائرة خضراء) كـ data-URI — لا تُحمَّل من قوقل.
const CAR_ICON =
  'data:image/svg+xml;utf8,' +
  encodeURIComponent(
    `<svg xmlns="http://www.w3.org/2000/svg" width="46" height="46">` +
      `<circle cx="23" cy="23" r="18" fill="#0F7B3F" stroke="#fff" stroke-width="3"/>` +
      `<text x="23" y="30" font-size="20" text-anchor="middle">🚗</text></svg>`,
  )

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  marker?: google.maps.LatLngLiteral
  /** موقع السائق المباشر — يُعرض بأيقونة سيارة مميّزة. */
  driver?: google.maps.LatLngLiteral
  /** خط اتجاه مستقيم (مجاني) بين نقطتين، مثل السائق ← الوجهة. */
  line?: [google.maps.LatLngLiteral, google.maps.LatLngLiteral]
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  /** يُستدعى عند سحب المستخدم للخريطة فعلياً (تفاعل حقيقي). */
  onUserDrag?: () => void
  className?: string
}

/**
 * خريطة قوقل مغلّفة. تعرض بديلاً واضحاً إذا لم يُضبط مفتاح الـ API.
 * تحريك العلامات (تتبّع السائق) لا يُكلّف طلبات إضافية من قوقل.
 */
export default function MapView({
  center = KHARTOUM,
  marker,
  driver,
  line,
  onCenterChanged,
  onUserDrag,
  className = 'h-64 w-full rounded-2xl',
}: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const { isLoaded } = useJsApiLoader({
    id: MAPS_LOADER_ID,
    googleMapsApiKey: GOOGLE_MAPS_API_KEY,
    libraries: MAPS_LIBRARIES,
  })

  if (!isMapsConfigured) {
    return (
      <div
        className={`grid place-items-center bg-green-mint text-center text-sm text-ink-soft ${className}`}
      >
        اضبط <code className="mx-1 rounded bg-white px-1">VITE_GOOGLE_MAPS_API_KEY</code>
        <br />
        لعرض الخريطة
      </div>
    )
  }

  if (!isLoaded) {
    return <div className={`animate-pulse bg-green-soft ${className}`} />
  }

  const handleIdle = () => {
    if (!onCenterChanged || !mapRef.current) return
    const c = mapRef.current.getCenter()
    if (c) onCenterChanged({ lat: c.lat(), lng: c.lng() })
  }

  return (
    <div className={`overflow-hidden ${className}`}>
      <GoogleMap
        mapContainerStyle={{ width: '100%', height: '100%' }}
        center={center}
        zoom={14}
        options={MAP_OPTIONS}
        onLoad={(map) => {
          mapRef.current = map
        }}
        onIdle={onCenterChanged ? handleIdle : undefined}
        onDragEnd={onUserDrag}
      >
        {marker && <MarkerF position={marker} />}
        {driver && (
          <MarkerF
            position={driver}
            icon={{
              url: CAR_ICON,
              scaledSize: new google.maps.Size(46, 46),
              anchor: new google.maps.Point(23, 23),
            }}
            zIndex={999}
          />
        )}
        {line && (
          <PolylineF
            path={line}
            options={{
              strokeColor: '#0F7B3F',
              strokeOpacity: 0.6,
              strokeWeight: 4,
              icons: [
                {
                  icon: { path: 'M 0,-1 0,1', strokeOpacity: 1, scale: 3 },
                  offset: '0',
                  repeat: '14px',
                },
              ],
            }}
          />
        )}
      </GoogleMap>
    </div>
  )
}
