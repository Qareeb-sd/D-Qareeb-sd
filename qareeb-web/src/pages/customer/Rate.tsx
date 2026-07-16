import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Star, CheckCircle2, Flag, ShieldAlert } from 'lucide-react'
import Screen from '@/components/Screen'
import { useRide } from '@/store/RideContext'
import { getService } from '@/data/services'
import { submitReview, getRideDriver, type RideDriverInfo } from '@/lib/api'
import { money } from '@/lib/format'

/** تقييم الرحلة + تحقّق مطابقة السائق/المركبة + شكوى اختيارية + إيصال. */
export default function Rate() {
  const navigate = useNavigate()
  const { rideId, serviceId, dropoff, payment, fare, reset } = useRide()
  const service = serviceId ? getService(serviceId) : undefined
  const total = fare ?? 0
  const [stars, setStars] = useState(5)
  const [complaint, setComplaint] = useState('')
  const [showComplaint, setShowComplaint] = useState(false)
  const [busy, setBusy] = useState(false)
  const [driver, setDriver] = useState<RideDriverInfo | null>(null)
  // للأمان: هل السائق/المركبة نفس المسجّل؟ (عدم التطابق = مخالفة حساب مُعار)
  const [driverSame, setDriverSame] = useState(true)
  const [vehicleSame, setVehicleSame] = useState(true)

  useEffect(() => {
    if (!rideId) return
    void getRideDriver(rideId).then(setDriver)
  }, [rideId])

  const paymentLabel =
    payment === 'cash' ? 'كاش' : payment === 'wallet' ? 'محفظة قريب' : 'تحويل بنكي'

  const finish = async () => {
    setBusy(true)
    if (rideId) {
      const { error } = await submitReview(rideId, stars, complaint, {
        driver: !driverSame,
        vehicle: !vehicleSame,
      })
      if (error) {
        setBusy(false)
        return alert(error)
      }
    }
    reset()
    // استبدال: بعد التقييم لا يجوز الرجوع لصفحة التقييم بزرّ الرجوع.
    navigate('/home', { replace: true })
  }

  return (
    <Screen title="تقييم الرحلة">
      <div className="flex flex-col items-center gap-2 py-6 text-center">
        <CheckCircle2 className="h-14 w-14 text-royal" strokeWidth={1.6} />
        <p className="text-lg font-bold text-royal">وصلت بالسلامة!</p>
        <p className="text-sm text-ink-soft">
          كيف كانت رحلتك{driver?.full_name ? ` مع ${driver.full_name}` : ''}؟
        </p>
      </div>

      <div className="flex justify-center gap-2 py-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} onClick={() => setStars(n)} aria-label={`${n} نجوم`}>
            <Star
              className={`h-9 w-9 ${n <= stars ? 'fill-sand text-sand' : 'text-hairline'}`}
              strokeWidth={1.5}
            />
          </button>
        ))}
      </div>

      {/* تحقّق المطابقة (أمان) — عدم التطابق مخالفة تصل للإدارة */}
      <div className="card mt-4 space-y-3 p-4">
        <p className="flex items-center gap-1.5 text-sm font-bold text-royal">
          <ShieldAlert className="h-4 w-4 text-sand-ink" strokeWidth={2} />
          للأمان: تأكيد المطابقة
        </p>
        <MatchQuestion
          label="هل السائق هو نفسه الظاهر في التطبيق؟"
          photo={driver?.photo_url}
          same={driverSame}
          onChange={setDriverSame}
        />
        <MatchQuestion
          label="هل المركبة هي نفسها المسجّلة؟"
          photo={driver?.vehicle_photo_url}
          rounded="rounded-lg"
          same={vehicleSame}
          onChange={setVehicleSame}
        />
        {(!driverSame || !vehicleSame) && (
          <p className="rounded-xl bg-danger/10 px-3 py-2 text-xs text-danger">
            سنُبلّغ إدارة قريب — استخدام حساب سائق من شخص/مركبة أخرى مخالفة.
          </p>
        )}
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
            className="flex w-full items-center justify-center gap-1.5 text-center text-sm font-medium text-danger"
          >
            <Flag className="h-4 w-4" strokeWidth={2} /> هل لديك شكوى عن السائق؟
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
      <span className={strong ? 'font-extrabold text-royal' : 'font-medium'}>{value}</span>
    </div>
  )
}

/** سؤال مطابقة: صورة مرجعية + «نعم / مختلف». */
function MatchQuestion({
  label,
  photo,
  same,
  onChange,
  rounded = 'rounded-full',
}: {
  label: string
  photo?: string | null
  same: boolean
  onChange: (v: boolean) => void
  rounded?: string
}) {
  return (
    <div className="flex items-center gap-2.5">
      {photo ? (
        <img src={photo} alt="" className={`h-10 w-10 shrink-0 object-cover ${rounded} ring-1 ring-hairline`} />
      ) : (
        <span className={`h-10 w-10 shrink-0 bg-royal-soft ${rounded}`} />
      )}
      <p className="flex-1 text-[13px] leading-snug text-ink-soft">{label}</p>
      <div className="flex shrink-0 gap-1">
        <button
          onClick={() => onChange(true)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            same ? 'bg-royal text-white' : 'bg-ivory text-ink-soft'
          }`}
        >
          نعم
        </button>
        <button
          onClick={() => onChange(false)}
          className={`rounded-xl px-3 py-1.5 text-xs font-bold transition ${
            !same ? 'bg-danger text-white' : 'bg-ivory text-ink-soft'
          }`}
        >
          مختلف
        </button>
      </div>
    </div>
  )
}
