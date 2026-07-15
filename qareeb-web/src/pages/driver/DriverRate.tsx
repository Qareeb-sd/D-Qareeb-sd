import { useState } from 'react'
import { useNavigate, useLocation, Navigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import { CheckCircle2, Flag } from 'lucide-react'
import { StarIcon } from '@/components/Icons'
import { submitReview } from '@/lib/api'

/** تقييم السائق للعميل بعد إتمام الرحلة + شكوى اختيارية. */
export default function DriverRate() {
  const navigate = useNavigate()
  const location = useLocation()
  const rideId = (location.state as { rideId?: string } | null)?.rideId
  const [stars, setStars] = useState(5)
  const [complaint, setComplaint] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [busy, setBusy] = useState(false)

  // لا رحلة مكتملة في السياق → عد للمحفظة.
  if (!rideId) return <Navigate to="/driver/wallet" replace />

  const finish = async () => {
    setBusy(true)
    const { error } = await submitReview(rideId, stars, complaint)
    setBusy(false)
    if (error) return alert(error)
    navigate('/driver/wallet')
  }

  return (
    <Screen title="تقييم العميل">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-royal" strokeWidth={2} />
        <p className="text-lg font-bold">تمّت الرحلة</p>
        <p className="text-sm text-ink-soft">كيف كان تعاملك مع العميل؟</p>
      </div>

      <div className="flex justify-center gap-2 py-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} نجوم`}>
            <StarIcon
              width={38}
              height={38}
              className={n <= stars ? 'text-sand' : 'text-hairline'}
              fill={n <= stars ? '#C4A265' : 'none'}
            />
          </button>
        ))}
      </div>

      {/* شكوى اختيارية عن العميل */}
      <div className="mt-4">
        {showComplaint ? (
          <div className="card p-4">
            <p className="mb-2 text-sm font-bold">شكوى عن العميل (اختياري)</p>
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
            className="inline-flex w-full items-center justify-center gap-1.5 text-center text-sm font-medium text-danger"
          >
            <Flag className="h-4 w-4 shrink-0" strokeWidth={2} />
            هل لديك شكوى عن العميل؟
          </button>
        )}
      </div>

      <button className="btn-driver mt-6 w-full" onClick={finish} disabled={busy}>
        {busy ? '…' : 'تم'}
      </button>
    </Screen>
  )
}
