import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import { StarIcon } from '@/components/Icons'
import { useRide } from '@/store/RideContext'
import { getService } from '@/data/services'
import { submitReview, getRideDriver } from '@/lib/api'
import { money } from '@/lib/format'

/** تقييم الرحلة + شكوى اختيارية + إيصال مختصر. */
export default function Rate() {
  const navigate = useNavigate()
  const { rideId, serviceId, dropoff, payment, fare, reset } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0
  const [stars, setStars] = useState(5)
  const [complaint, setComplaint] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [driverName, setDriverName] = useState<string | null>(null)

  useEffect(() => {
    if (!rideId) return
    void getRideDriver(rideId).then((d) => setDriverName(d?.full_name ?? null))
  }, [rideId])

  const paymentLabel =
    payment === 'cash' ? 'كاش' : payment === 'wallet' ? 'محفظة قريب' : 'تحويل بنكي'

  const finish = async () => {
    setBusy(true)
    if (rideId) {
      const { error } = await submitReview(rideId, stars, complaint)
      if (error) {
        setBusy(false)
        return alert(error)
      }
    }
    reset()
    navigate('/home')
  }

  return (
    <Screen title="تقييم الرحلة">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-bold">وصلت بالسلامة!</p>
        <p className="text-sm text-ink-soft">
          كيف كانت رحلتك{driverName ? ` مع ${driverName}` : ''}؟
        </p>
      </div>

      <div className="flex justify-center gap-2 py-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} نجوم`}>
            <StarIcon
              width={38}
              height={38}
              className={n <= stars ? 'text-gold' : 'text-hairline'}
              fill={n <= stars ? '#C9A138' : 'none'}
            />
          </button>
        ))}
      </div>

      {/* شكوى اختيارية عن السائق */}
      <div className="mt-4">
        {showComplaint ? (
          <div className="card p-4">
            <p className="mb-2 text-sm font-bold">شكوى عن السائق (اختياري)</p>
            <textarea
              className="field min-h-[80px] resize-none"
              placeholder="اكتب ما حدث… ستصل الشكوى لإدارة قريب."
              value={complaint}
              onChange={(e) => setComplaint(e.target.value)}
            />
          </div>
        ) : (
          <button
            onClick={() => setShowComplaint(true)}
            className="w-full text-center text-sm font-medium text-danger"
          >
            🚩 هل لديك شكوى عن السائق؟
          </button>
        )}
      </div>

      {/* الإيصال */}
      <div className="card mt-6 divide-y divide-hairline p-0">
        <Row label="الخدمة" value={service?.name ?? '—'} />
        <Row label="الوجهة" value={dropoff?.address ?? '—'} />
        <Row label="طريقة الدفع" value={paymentLabel} />
        <Row label="الإجمالي" value={money(total)} strong />
      </div>

      <button className="btn-primary mt-6 w-full" onClick={finish} disabled={busy}>
        {busy ? '…' : 'تم'}
      </button>
    </Screen>
  )
}

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <div className="flex items-center justify-between px-4 py-3">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className={strong ? 'font-extrabold text-green' : 'font-medium'}>{value}</span>
    </div>
  )
}
