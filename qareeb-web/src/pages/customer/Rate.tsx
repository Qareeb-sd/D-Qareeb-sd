import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import { StarIcon } from '@/components/Icons'
import { useRide } from '@/store/RideContext'
import { getService } from '@/data/services'
import { completeRide } from '@/lib/api'
import { money } from '@/lib/format'

/** تقييم الرحلة + إيصال مختصر. */
export default function Rate() {
  const navigate = useNavigate()
  const { rideId, serviceId, dropoff, payment, fare, reset } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0
  const [stars, setStars] = useState(5)
  const [busy, setBusy] = useState(false)

  const paymentLabel =
    payment === 'cash' ? 'كاش' : payment === 'wallet' ? 'محفظة قريب' : 'تحويل بنكي'

  const finish = async () => {
    setBusy(true)
    if (rideId) await completeRide(rideId, stars)
    reset()
    navigate('/home')
  }

  return (
    <Screen title="تقييم الرحلة">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <div className="text-5xl">✅</div>
        <p className="text-lg font-bold">وصلت بالسلامة!</p>
        <p className="text-sm text-ink-soft">كيف كانت رحلتك مع عثمان؟</p>
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
