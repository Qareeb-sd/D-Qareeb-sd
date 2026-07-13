import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import Logo from '@/components/Logo'
import { useRide } from '@/store/RideContext'
import { subscribeToRide } from '@/lib/realtime'
import { cancelRide, getRide } from '@/lib/api'
import { notify } from '@/lib/notifications'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * البحث عن سائق. ينتقل لشاشة الرحلة لحظة قبول السائق (Realtime).
 * في وضع المعاينة (بدون backend) ينتقل تلقائياً بعد لحظات.
 */
export default function FindDriver() {
  const navigate = useNavigate()
  const { rideId, reset } = useRide()
  const [busy, setBusy] = useState(false)
  const done = useRef(false)

  const cancel = async () => {
    setBusy(true)
    if (rideId) await cancelRide(rideId)
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
          if (ride.status !== 'searching' && ride.status !== 'requested' && ride.status !== 'cancelled') {
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
            if (ride.status === 'cancelled') return
            if (ride.status !== 'searching' && ride.status !== 'requested') onAccepted()
          }, 4000)
        : undefined

    // بديل المعاينة: انتقال تلقائي.
    const t = !isSupabaseConfigured ? setTimeout(() => navigate('/trip'), 2500) : undefined

    return () => {
      unsub()
      if (poll) clearInterval(poll)
      if (t) clearTimeout(t)
    }
  }, [rideId, navigate])

  return (
    <Screen title="البحث عن سائق" back>
      <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
        <div className="relative grid place-items-center">
          <span className="absolute h-28 w-28 animate-ping rounded-full bg-royal/20" />
          <span className="absolute h-20 w-20 animate-pulse rounded-full bg-sand/20" />
          <Logo size={64} rounded={18} />
        </div>
        <div>
          <p className="text-lg font-bold text-royal">نبحث عن أقرب سائق…</p>
          <p className="text-sm text-ink-soft">لحظات ونلقى ليك سائق قريب</p>
        </div>
        <button
          className="press-scale rounded-2xl border border-hairline bg-white px-8 py-3 font-bold text-danger"
          onClick={cancel}
          disabled={busy}
        >
          {busy ? '…' : 'إلغاء'}
        </button>
      </div>
    </Screen>
  )
}
