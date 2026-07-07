import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import { useRide } from '@/store/RideContext'
import { KHARTOUM } from '@/theme'

/** تحديد موقع الوجهة على الخريطة. المؤشّر ثابت في المنتصف والخريطة تتحرك تحته. */
export default function SelectLocation() {
  const navigate = useNavigate()
  const { setDropoff, pickup } = useRide()
  const [center, setCenter] = useState<google.maps.LatLngLiteral>(pickup.pos ?? KHARTOUM)
  const [address, setAddress] = useState('')

  const confirm = () => {
    setDropoff({ pos: center, address: address || 'وجهة على الخريطة' })
    navigate('/find-driver')
  }

  return (
    <Screen title="حدد الوجهة" back bare>
      <div className="relative flex h-full flex-col">
        <div className="relative flex-1">
          <MapView
            center={center}
            onCenterChanged={setCenter}
            className="h-full w-full"
          />
          {/* المؤشّر الثابت في المنتصف */}
          <div className="pointer-events-none absolute inset-0 grid place-items-center">
            <div className="-mt-6 text-4xl">📍</div>
          </div>
        </div>

        <div className="space-y-3 border-t border-hairline bg-bg p-4">
          <input
            className="field"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
            placeholder="اسم المكان (اختياري)"
          />
          <button className="btn-primary w-full" onClick={confirm}>
            تأكيد الوجهة
          </button>
        </div>
      </div>
    </Screen>
  )
}
