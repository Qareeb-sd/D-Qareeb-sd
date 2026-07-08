import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Logo from '@/components/Logo'
import DriverNav from '@/components/DriverNav'
import VehicleImage from '@/components/VehicleImage'
import { useAuth } from '@/store/AuthContext'
import { useDriver } from '@/store/DriverContext'
import { getDriver, setDriverOnline, listAvailableRides, acceptRide } from '@/lib/api'
import { subscribeToRides } from '@/lib/realtime'
import { isPushConfigured, isPushEnabled, enablePush, disablePush } from '@/lib/push'
import { getService } from '@/data/services'
import { money } from '@/lib/format'
import type { Driver, Ride } from '@/lib/types'

/** واجهة السائق: التوفّر (متصل/غير متصل) + الطلبات الواردة وقبولها. */
export default function DriverHome() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { setActiveRide } = useDriver()
  const userId = profile?.id ?? 'demo-user'

  const [driver, setDriver] = useState<Driver | null>(null)
  const [online, setOnline] = useState(false)
  const [rides, setRides] = useState<Ride[]>([])
  const [busyId, setBusyId] = useState<string | null>(null)
  const [pushOn, setPushOn] = useState(false)
  const [pushBusy, setPushBusy] = useState(false)

  useEffect(() => {
    void getDriver(userId).then((d) => {
      setDriver(d)
      setOnline(d?.is_online ?? false)
    })
  }, [userId])

  useEffect(() => {
    void isPushEnabled().then(setPushOn)
  }, [])

  const togglePush = async () => {
    setPushBusy(true)
    if (pushOn) {
      await disablePush()
      setPushOn(false)
    } else {
      const { error } = await enablePush(userId)
      if (error) alert(error)
      else setPushOn(true)
    }
    setPushBusy(false)
  }

  useEffect(() => {
    if (!online) {
      setRides([])
      return
    }
    let alive = true
    const load = () => listAvailableRides().then((r) => alive && setRides(r))
    void load()
    // Realtime: أعِد الجلب فور أي تغيّر على الرحلات + استطلاع احتياطي بطيء.
    const unsub = subscribeToRides(load)
    const iv = setInterval(load, 20000)
    return () => {
      alive = false
      unsub()
      clearInterval(iv)
    }
  }, [online])

  const toggleOnline = async () => {
    const next = !online
    setOnline(next)
    if (driver) await setDriverOnline(driver.id, next)
  }

  const accept = async (ride: Ride) => {
    setBusyId(ride.id)
    const { error } = await acceptRide(ride.id, userId)
    setBusyId(null)
    if (error) return alert(error)
    setActiveRide({ ...ride, driver_id: userId, status: 'accepted' })
    navigate('/driver/trip')
  }

  return (
    <div className="screen">
      <header className="flex items-center gap-3 border-b border-hairline px-4 py-4">
        <Logo variant="driver" size={38} rounded={12} />
        <div className="flex-1">
          <p className="font-extrabold text-green">قريب · السائق</p>
          <p className="text-xs text-ink-muted">⭐ {driver?.rating ?? '—'}</p>
        </div>
        {/* زر تفعيل الإشعارات (يظهر فقط عند تهيئتها) */}
        {isPushConfigured && (
          <button
            onClick={togglePush}
            disabled={pushBusy}
            aria-label={pushOn ? 'إيقاف الإشعارات' : 'تفعيل الإشعارات'}
            title={pushOn ? 'الإشعارات مفعّلة' : 'فعّل إشعارات الطلبات'}
            className={`grid h-9 w-9 place-items-center rounded-full text-lg transition ${
              pushOn ? 'bg-green-soft text-green' : 'bg-hairline text-ink-soft'
            }`}
          >
            {pushOn ? '🔔' : '🔕'}
          </button>
        )}
        {/* مفتاح التوفّر */}
        <button
          onClick={toggleOnline}
          role="switch"
          aria-checked={online}
          className={`flex items-center gap-2 rounded-full px-3 py-1.5 text-sm font-bold transition ${
            online ? 'bg-green text-white' : 'bg-hairline text-ink-soft'
          }`}
        >
          <span className={`h-2 w-2 rounded-full ${online ? 'bg-lemon' : 'bg-ink-muted'}`} />
          {online ? 'متصل' : 'غير متصل'}
        </button>
      </header>

      <main className="flex-1 px-4 pt-4 pb-24">
        {!online ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center text-ink-soft">
            <div className="text-5xl">🚗💤</div>
            <p className="font-bold">أنت غير متصل</p>
            <p className="text-sm">فعّل الاتصال لاستقبال الطلبات القريبة.</p>
          </div>
        ) : rides.length === 0 ? (
          <div className="flex flex-col items-center gap-3 py-24 text-center text-ink-soft">
            <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-soft border-t-green" />
            <p className="font-bold">بانتظار الطلبات…</p>
          </div>
        ) : (
          <div className="space-y-3">
            <h2 className="font-bold">طلبات واردة</h2>
            {rides.map((r) => {
              const service = getService(r.service_id)
              return (
                <div key={r.id} className="card p-4">
                  <div className="flex items-center gap-3">
                    {service && <VehicleImage service={service} className="h-12 w-16" />}
                    <div className="flex-1">
                      <p className="font-bold">{service?.name ?? r.service_id}</p>
                      <p className="text-sm text-ink-soft">
                        {r.pickup_address} ← {r.dropoff_address}
                      </p>
                    </div>
                    <p className="font-extrabold text-green">{money(r.fare ?? 0)}</p>
                  </div>
                  <button
                    onClick={() => accept(r)}
                    disabled={busyId === r.id}
                    className="btn-primary mt-3 w-full"
                  >
                    {busyId === r.id ? '…' : 'قبول الطلب'}
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </main>

      <DriverNav />
    </div>
  )
}
