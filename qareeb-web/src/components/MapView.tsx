import { useRef } from 'react'
import { useJsApiLoader, GoogleMap, MarkerF } from '@react-google-maps/api'
import {
  GOOGLE_MAPS_API_KEY,
  MAPS_LIBRARIES,
  MAPS_LOADER_ID,
  MAP_OPTIONS,
  isMapsConfigured,
} from '@/lib/maps'
import { KHARTOUM } from '@/theme'

interface MapViewProps {
  center?: google.maps.LatLngLiteral
  marker?: google.maps.LatLngLiteral
  onCenterChanged?: (pos: google.maps.LatLngLiteral) => void
  className?: string
}

/**
 * خريطة قوقل مغلّفة. تعرض بديلاً واضحاً إذا لم يُضبط مفتاح الـ API.
 */
export default function MapView({
  center = KHARTOUM,
  marker,
  onCenterChanged,
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
      >
        {marker && <MarkerF position={marker} />}
      </GoogleMap>
    </div>
  )
}
