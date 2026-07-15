import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import Logo from '@/components/Logo'
import { useRide } from '@/store/RideContext'
import { subscribeToRide } from '@/lib/realtime'
import { cancelRide, getRide } from '@/lib/api'
import CancelReasonSheet, { type CancelReason } from '@/components/CancelReasonSheet'
import { notify } from '@/lib/notifications'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * البحث عن سائق. ينتقل لشاشة الرحلة لحظة قبول السائق (Realtime + استطلاع احتياطي).
 * يعالج: مهلة بلا سائق، إلغاء خارجي (سائق/أدمن)، وتأكيد قبل الإلغاء.
 * في وضع المعاينة (بدون backend) ينتقل تلقائياً بعد لحظات.
 */

// مهلة قبل عرض حالة «لا يوجد سائق قريب» (الرحلة تبقى قائمة والبحث مستمرّ).
const NO_DRIVER_MS = 90_000

export default function FindDriver() {
  const navigate = useNavigate()
  const { rideId, reset } = useRide()
  const [busy, setBusy] = useState(false)
  const [confirmCancel, setConfirmCancel] = useState(false)
  // searching → البحث جارٍ | timeout → طالت المدّة | cancelled → أُلغيت خارجياً
  const [phase, setPhase] = useState<'searching' | 'timeout' | 'cancelled'>('searching')
  const done = useRef(false)

  const cancel = async (reason: CancelReason) => {
    setBusy(true)
    // قبل قبول السائق لا رسوم إطلاقاً.
    if (rideId) await cancelRide(rideId, reason.label, reason.code)
    reset()
    navigate('/home')
  }

  const backHome = () => {
    reset()
    navigate('/home')
  }

  useEffect(() => {
    // عند قبول السائق: إشعار العميل (صوت + اهتزاز) ثم الانتقال لشاشة المتابعة.
    const onAccepted = () => {
      if (done.current) return
      done.current = true
      void notify('تم قبول رحلتك', 'السائق في الطريق إليك — تابع وصوله على الخريطة')
      navigate('/trip')
    }

    // Realtime (فوري إن عمل).
    const unsub = rideId
      ? subscribeToRide(rideId, (ride) => {
          if (ride.status === 'cancelled') {
            if (!done.current) setPhase('cancelled')
          } else if (ride.status !== 'searching' && ride.status !== 'requested') {
            onAccepted()
          }
        })
      : () => {}

    // استطلاع احتياطي كل 4 ثوانٍ — يعمل حتى لو تعطّل Realtime على الجهاز.
    const poll =
      isSupabaseConfigured && rideId
        ? setInterval(async () => {
            const ride = await getRide(rideId)
            if (!ride) return
            if (ride.status === 'cancelled') {
              if (!done.current) setPhase('cancelled')
              return
            }
            if (ride.status !== 'searching' && ride.status !== 'requested') onAccepted()
          }, 4000)
        : undefined

    // مهلة «طالت المدّة» — لا تُلغي الرحلة، فقط تعرض خيارات للعميل.
    const timeout = isSupabaseConfigured
      ? setTimeout(() => {
          if (!done.current) setPhase((p) => (p === 'searching' ? 'timeout' : p))
        }, NO_DRIVER_MS)
      : undefined

    // بديل المعاينة: انتقال تلقائي.
    const t = !isSupabaseConfigured ? setTimeout(() => navigate('/trip'), 2500) : undefined

    return () => {
      unsub()
      if (poll) clearInterval(poll)
      if (timeout) clearTimeout(timeout)
      if (t) clearTimeout(t)
    }
  }, [rideId, navigate])

  // أُلغيت الرحلة خارجياً (من السائق أو الأدمن).
  if (phase === 'cancelled') {
    return (
      <Screen title="تعذّر إكمال الطلب" back>
        <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
          <Logo size={56} rounded={16} />
          <div>
            <p className="text-lg font-bold text-royal">أُلغي الطلب</p>
            <p className="mt-1 text-sm text-ink-soft">
              تعذّر إكمال هذا الطلب. يمكنك المحاولة من جديد.
            </p>
          </div>
          <button
            className="press-scale rounded-2xl bg-royal px-8 py-3 font-bold text-white"
            onClick={backHome}
          >
            العودة للرئيسية
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="البحث عن سائق" back>
      <div className="flex flex-col items-center justify-center gap-6 py-16 text-center">
        <div className="relative grid place-items-center">
          <span className="absolute h-28 w-28 animate-ping rounded-full bg-royal/20" />
          <span className="absolute h-20 w-20 animate-pulse rounded-full bg-sand/20" />
          <Logo size={64} rounded={18} />
        </div>

        {phase === 'timeout' ? (
          <div>
            <p className="text-lg font-bold text-royal">ما زلنا نبحث لك عن سائق…</p>
            <p className="mt-1 text-sm text-ink-soft">
              الازدحام مرتفع الآن. يمكنك الاستمرار في الانتظار أو إلغاء الطلب.
            </p>
          </div>
        ) : (
          <div>
            <p className="text-lg font-bold text-royal">نبحث عن أقرب سائق…</p>
            <p className="text-sm text-ink-soft">لحظات ونلقى ليك سائق قريب</p>
          </div>
        )}

        {confirmCancel ? (
          <div className="w-full max-w-xs">
            <CancelReasonSheet
              busy={busy}
              onConfirm={cancel}
              onDismiss={() => setConfirmCancel(false)}
            />
          </div>
        ) : (
          <button
            className="press-scale rounded-2xl border border-hairline bg-white px-8 py-3 font-bold text-danger"
            onClick={() => setConfirmCancel(true)}
          >
            إلغاء
          </button>
        )}
      </div>
    </Screen>
  )
}
