import MapView from './MapView'
import MapPin from './MapPin'

/** خريطة بمؤشّر ثابت في المنتصف لاختيار موقع (يتحرّك المؤشّر مع تحريك الخريطة). */
export default function LocationPicker({
  center,
  onChange,
  className = 'h-52',
}: {
  center: google.maps.LatLngLiteral
  onChange: (pos: google.maps.LatLngLiteral) => void
  className?: string
}) {
  return (
    <div className={`relative ${className}`}>
      <MapView center={center} onCenterChanged={onChange} className="h-full w-full rounded-2xl" />
      <MapPin />
    </div>
  )
}
