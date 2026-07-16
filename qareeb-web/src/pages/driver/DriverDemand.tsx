import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { ChevronRight, Flame, RefreshCw } from 'lucide-react'
import MapView from '@/components/MapView'
import Logo from '@/components/Logo'
import { getDemandHotspots } from '@/lib/api'
import { getCurrentPos, loadLastPos } from '@/lib/geo'
import { KHARTOUM } from '@/theme'

/** خريطة الطلب للسائق — مناطق يكثر فيها الطلب (آخر 3 ساعات) كطبقة حرارية. */
export default function DriverDemand() {
  const navigate = useNavigate()
  const [center, setCenter] = useState(loadLastPos() ?? KHARTOUM)
  const [heat, setHeat] = useState<{ lat: number; lng: number }[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    void getDemandHotspots(3).then((pts) => {
      setHeat(pts)
      setLoading(false)
    })
  }

  useEffect(() => {
    void getCurrentPos().then((p) => p && setCenter(p))
    load()
    const iv = setInterval(load, 60000)
    return () => clearInterval(iv)
  }, [])

  return (
    <div className="screen font-plex bg-ivory">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <button onClick={() => navigate(-1)} className="grid h-9 w-9 place-items-center rounded-full bg-ivory">
          <ChevronRight className="h-5 w-5 text-royal" strokeWidth={2} />
        </button>
        <Logo variant="driver" size={32} rounded={9} />
        <h1 className="flex-1 text-lg font-bold">خريطة الطلب</h1>
        <button onClick={load} className="grid h-9 w-9 place-items-center rounded-full bg-ivory text-royal" aria-label="تحديث">
          <RefreshCw className={`h-5 w-5 ${loading ? 'animate-spin' : ''}`} strokeWidth={2} />
        </button>
      </header>

      <div className="relative flex-1">
        <MapView center={center} heat={heat} zoom={13} className="absolute inset-0" />

        <div className="pointer-events-none absolute inset-x-3 top-3 flex justify-center">
          <span className="flex items-center gap-1.5 rounded-full bg-white/95 px-4 py-2 text-xs font-bold text-royal shadow-float">
            <Flame className="h-4 w-4 text-orange-500" strokeWidth={2.4} />
            {heat.length > 0
              ? `${heat.length} طلب خلال آخر ٣ ساعات — المناطق الأكثر برتقالية أكثر طلباً`
              : loading
                ? 'جارٍ تحميل مناطق الطلب…'
                : 'لا طلبات حديثة في آخر ٣ ساعات'}
          </span>
        </div>
      </div>
    </div>
  )
}
