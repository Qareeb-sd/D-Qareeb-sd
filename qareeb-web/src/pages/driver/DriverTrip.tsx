import { useEffect, useState } from 'react'
import { useNavigate, Navigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import MapView from '@/components/MapView'
import { useDriver } from '@/store/DriverContext'
import { useAuth } from '@/store/AuthContext'
import { settleRide, getSettings, getActiveDriverRide } from '@/lib/api'
import { getService } from '@/data/services'
import { money } from '@/lib/format'

const paymentLabels: Record<string, string> = {
  cash: 'كاش',
  bank_transfer: 'تحويل بنكي',
  wallet: 'محفظة قريب',
}

/** الرحلة الجارية للسائق — بيانات الرحلة، وإكمالها مع تسوية الأرباح (خصم العمولة). */
export default function DriverTrip() {
  const navigate = useNavigate()
  const { profile } = useAuth()
  const { activeRide, setActiveRide } = useDriver()
  const [rate, setRate] = useState(0.15)
  const [busy, setBusy] = useState(false)
  const [recovering, setRecovering] = useState(!activeRide)

  useEffect(() => {
    void getSettings().then((s) => setRate(s.commission_rate))
  }, [])

  // استرجاع الرحلة الجارية بعد تحديث الصفحة (تُفقد من الذاكرة).
  useEffect(() => {
    if (activeRide || !profile?.id) {
      setRecovering(false)
      return
    }
    let alive = true
    void getActiveDriverRide(profile.id).then((ride) => {
      if (!alive) return
      if (ride) setActiveRide(ride)
      setRecovering(false)
    })
    return () => {
      alive = false
    }
  }, [activeRide, profile?.id, setActiveRide])

  if (recovering) {
    return (
      <Screen title="الرحلة الجارية">
        <div className="flex justify-center py-24">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-green-soft border-t-green" />
        </div>
      </Screen>
    )
  }

  if (!activeRide) return <Navigate to="/driver" replace />

  const service = getService(activeRide.service_id)
  const fare = activeRide.fare ?? 0
  const commission = Math.round(fare * rate)
  const net = fare - commission
  const isCash = activeRide.payment_method !== 'wallet'

  const complete = async () => {
    setBusy(true)
    const { error } = await settleRide(activeRide.id)
    setBusy(false)
    if (error) return alert(error)
    setActiveRide(null)
    navigate('/driver/wallet')
  }

  return (
    <Screen title="الرحلة الجارية" bare>
      <div className="flex h-full flex-col">
        <MapView
          center={{ lat: activeRide.pickup_lat, lng: activeRide.pickup_lng }}
          marker={
            activeRide.dropoff_lat && activeRide.dropoff_lng
              ? { lat: activeRide.dropoff_lat, lng: activeRide.dropoff_lng }
              : undefined
          }
          className="h-56 w-full"
        />

        <div className="flex-1 space-y-4 p-4">
          <div className="card p-4">
            <p className="font-bold">{service?.name ?? activeRide.service_id}</p>
            <p className="mt-1 text-sm text-ink-soft">
              {activeRide.pickup_address} ← {activeRide.dropoff_address}
            </p>
          </div>

          {/* تفصيل الأرباح */}
          <div className="card divide-y divide-hairline p-0">
            <Row label="طريقة الدفع" value={paymentLabels[activeRide.payment_method]} />
            <Row label="الأجرة" value={money(fare)} />
            <Row
              label={`عمولة المنصة (${Math.round(rate * 100)}%)`}
              value={`− ${money(commission)}`}
              danger
            />
            <Row label="صافي أرباحك" value={money(net)} strong />
          </div>

          {isCash && (
            <p className="text-center text-xs text-ink-muted">
              تستلم الأجرة من الراكب مباشرة، وتُخصم العمولة ({money(commission)}) من محفظتك.
            </p>
          )}
        </div>

        <div className="border-t border-hairline p-4">
          <button className="btn-primary w-full" onClick={complete} disabled={busy}>
            {busy ? '…' : 'إنهاء وتسوية الرحلة'}
          </button>
        </div>
      </div>
    </Screen>
  )
}

function Row({
  label,
  value,
  strong,
  danger,
}: {
  label: string
  value: string
  strong?: boolean
  danger?: boolean
}) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <span
        className={
          strong ? 'font-extrabold text-green' : danger ? 'font-medium text-danger' : 'font-medium'
        }
      >
        {value}
      </span>
    </div>
  )
}
