import { useEffect, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MapView from '@/components/MapView'
import { trackSharedRide } from '@/lib/api'
import { getService } from '@/data/services'
import type { TrackedRide, RideStatus } from '@/lib/types'

const statusText: Partial<Record<RideStatus, string>> = {
  requested: 'بانتظار سائق',
  searching: 'جارٍ البحث عن سائق',
  accepted: 'السائق في الطريق',
  arrived: 'وصل السائق',
  in_progress: 'الرحلة جارية',
  completed: 'انتهت الرحلة بالسلامة ✅',
  cancelled: 'أُلغيت الرحلة',
}

/** تتبّع رحلة مُشارَكة عبر رمز — يفتحها متابِع لديه التطبيق. */
export default function TrackRide() {
  const { token } = useParams()
  const navigate = useNavigate()
  const [code, setCode] = useState('')
  const [ride, setRide] = useState<TrackedRide | null>(null)
  const [notFound, setNotFound] = useState(false)

  // استطلاع دوري كل 4 ثوانٍ لموقع السائق وحالة الرحلة.
  useEffect(() => {
    if (!token) return
    let alive = true
    const load = async () => {
      const r = await trackSharedRide(token)
      if (!alive) return
      if (r) {
        setRide(r)
        setNotFound(false)
      } else setNotFound(true)
    }
    void load()
    const iv = setInterval(load, 4000)
    return () => {
      alive = false
      clearInterval(iv)
    }
  }, [token])

  // شاشة إدخال الرمز (عند /track بلا رمز).
  if (!token) {
    return (
      <div className="screen items-center justify-center p-6 text-center">
        <div className="text-5xl">👁️</div>
        <h1 className="mt-3 text-xl font-extrabold">تتبّع رحلة</h1>
        <p className="mt-1 text-sm text-ink-soft">
          أدخل رمز التتبّع الذي وصلك لمتابعة الرحلة مباشرة.
        </p>
        <input
          className="field mt-5 w-full max-w-xs text-center tracking-widest"
          placeholder="رمز التتبّع"
          value={code}
          onChange={(e) => setCode(e.target.value.trim())}
          autoFocus
        />
        <button
          onClick={() => code && navigate(`/track/${code}`)}
          disabled={!code}
          className="btn-primary mt-4 w-full max-w-xs"
        >
          تتبّع
        </button>
        <button onClick={() => navigate(-1)} className="mt-3 text-sm font-bold text-ink-muted">
          رجوع
        </button>
      </div>
    )
  }

  const driverPos =
    ride?.driver_lat != null && ride?.driver_lng != null
      ? { lat: ride.driver_lat, lng: ride.driver_lng }
      : undefined
  const dropoff =
    ride?.dropoff_lat != null && ride?.dropoff_lng != null
      ? { lat: ride.dropoff_lat, lng: ride.dropoff_lng }
      : undefined
  const service = ride ? getService(ride.service_id) : undefined

  return (
    <div className="screen">
      <header className="flex items-center gap-2 px-4 py-3">
        <button onClick={() => navigate('/track')} className="text-ink-muted">
          ‹
        </button>
        <h1 className="font-extrabold text-green">تتبّع الرحلة</h1>
      </header>

      <MapView
        marker={dropoff}
        driver={driverPos}
        center={driverPos ?? dropoff}
        className="h-72 w-full"
      />

      <div className="flex-1 space-y-3 p-4">
        {notFound && !ride ? (
          <div className="card p-5 text-center text-sm text-ink-soft">
            رمز غير صالح أو انتهت مشاركته. تأكّد من الرمز.
          </div>
        ) : !ride ? (
          <p className="py-8 text-center text-sm text-ink-muted">…جارٍ التحميل</p>
        ) : (
          <>
            <div className="card flex items-center gap-3 p-4">
              <span className="text-2xl">🚗</span>
              <div className="flex-1">
                <p className="font-bold">{statusText[ride.status] ?? ride.status}</p>
                <p className="text-sm text-ink-soft">
                  {service?.name ?? ride.service_id}
                  {ride.driver_name ? ` · السائق: ${ride.driver_name}` : ''}
                </p>
              </div>
            </div>
            <div className="card p-4 text-sm">
              <p className="text-ink-muted">الوجهة</p>
              <p className="font-medium">{ride.dropoff_address ?? '—'}</p>
            </div>
            {ride.driver_loc_at && (
              <p className="text-center text-xs text-ink-muted">
                آخر تحديث لموقع السائق: {new Date(ride.driver_loc_at).toLocaleTimeString('ar')}
              </p>
            )}
          </>
        )}
      </div>
    </div>
  )
}
