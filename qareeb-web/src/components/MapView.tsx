import { useRef } from 'react'
import { GoogleMap, MarkerF } from '@react-google-maps/api'
import { MAP_OPTIONS, isMapsConfigured } from '@/lib/maps'
import { useMaps } from '@/store/MapsContext'
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
  /** علامات متعددة (مثل نقاط انطلاق الرحلات النشطة في لوحة الأدمن). */
  markers?: google.maps.LatLngLiteral[]
  /** مواقع سائقين متعددة (أيقونة سيارة). */
  driverMarkers?: google.maps.LatLngLiteral[]
  zoom?: number
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
  markers,
  driverMarkers,
  zoom = 14,
  onCenterChanged,
  onUserDrag,
  className = 'h-64 w-full rounded-2xl',
}: MapViewProps) {
  const mapRef = useRef<google.maps.Map | null>(null)
  const { isLoaded, mapsError } = useMaps()

  // لا مفتاح، أو فشلت خرائط قوقل (حجب/مصادقة) → الخريطة المبسّطة الأنيقة.
  if (!isMapsConfigured || mapsError) {
    return (
      <div className={`relative overflow-hidden ${className}`}>
        {/* بديل أنيق للخريطة قبل ضبط مفتاح قوقل — رسم شوارع مبسّط */}
        <svg
          viewBox="0 0 400 260"
          preserveAspectRatio="xMidYMid slice"
          className="h-full w-full"
          xmlns="http://www.w3.org/2000/svg"
        >
          <rect width="400" height="260" fill="#EAF3EC" />
          {/* كتل المباني */}
          <g fill="#DCEAE0">
            <rect x="24" y="30" width="70" height="52" rx="6" />
            <rect x="300" y="26" width="76" height="60" rx="6" />
            <rect x="40" y="176" width="80" height="60" rx="6" />
            <rect x="286" y="182" width="86" height="56" rx="6" />
          </g>
          {/* الشوارع */}
          <path d="M0 132 H400" stroke="#CFE0D4" strokeWidth="16" />
          <path d="M150 0 V260" stroke="#CFE0D4" strokeWidth="16" />
          {/* مسار الرحلة الذهبي */}
          <path
            d="M70 210 Q150 150 210 132 Q280 110 340 60"
            stroke="#C9A138"
            strokeWidth="4"
            strokeLinecap="round"
            strokeDasharray="10 8"
            fill="none"
          />
          {/* نقطة البداية */}
          <circle cx="70" cy="210" r="7" fill="#0F7B3F" stroke="#fff" strokeWidth="3" />
          {/* دبوس الوجهة */}
          <path
            d="M340 36c-9 0-16 7-16 16 0 11 16 26 16 26s16-15 16-26c0-9-7-16-16-16Z"
            fill="#E11D48"
          />
          <circle cx="340" cy="52" r="6" fill="#fff" />
        </svg>
        <span className="absolute inset-x-0 bottom-2 text-center text-xs font-medium text-ink-soft">
          معاينة الخريطة
        </span>
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
        zoom={zoom}
        options={MAP_OPTIONS}
        onLoad={(map) => {
          mapRef.current = map
        }}
        onIdle={onCenterChanged ? handleIdle : undefined}
        onDragEnd={onUserDrag}
        onTilesLoaded={() => console.log('[qareeb] tilesloaded ✓')}
      >
        {marker && <MarkerF position={marker} />}
        {markers?.map((m, i) => <MarkerF key={`m${i}`} position={m} />)}
        {driverMarkers?.map((d, i) => (
          <MarkerF
            key={`dm${i}`}
            position={d}
            icon={{
              url: CAR_ICON,
              scaledSize: new google.maps.Size(40, 40),
              anchor: new google.maps.Point(20, 20),
            }}
            zIndex={998}
          />
        ))}
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
      </GoogleMap>
    </div>
  )
}
