import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import Logo from '@/components/Logo'
import { useRide } from '@/store/RideContext'
import { subscribeToRide } from '@/lib/realtime'
import { cancelRide } from '@/lib/api'
import { isSupabaseConfigured } from '@/lib/supabase'

/**
 * البحث عن سائق. ينتقل لشاشة الرحلة لحظة قبول السائق (Realtime).
 * في وضع المعاينة (بدون backend) ينتقل تلقائياً بعد لحظات.
 */
export default function FindDriver() {
  const navigate = useNavigate()
  const { rideId, reset } = useRide()
  const [busy, setBusy] = useState(false)

  const cancel = async () => {
    setBusy(true)
    if (rideId) await cancelRide(rideId)
    reset()
    navigate('/home')
  }

  useEffect(() => {
    // Realtime: انتظر تحديث حالة الرحلة إلى "مقبولة" فأبعد.
    const unsub = rideId
      ? subscribeToRide(rideId, (ride) => {
          if (ride.status !== 'searching' && ride.status !== 'requested' && ride.status !== 'cancelled') {
            navigate('/trip')
          }
        })
      : () => {}

    // بديل المعاينة: انتقال تلقائي.
    const t = !isSupabaseConfigured ? setTimeout(() => navigate('/trip'), 2500) : undefined

    return () => {
      unsub()
      if (t) clearTimeout(t)
    }
  }, [rideId, navigate])

  return (
    <Screen title="البحث عن سائق" back>
      <div className="flex flex-col items-center justify-center gap-6 py-20 text-center">
        <div className="relative grid place-items-center">
          <span className="absolute h-28 w-28 animate-ping rounded-full bg-green/20" />
          <span className="absolute h-20 w-20 animate-pulse rounded-full bg-green/10" />
          <Logo size={64} rounded={18} />
        </div>
        <div>
          <p className="text-lg font-bold">نبحث عن أقرب سائق…</p>
          <p className="text-sm text-ink-soft">لحظات ونلقى ليك سائق قريب</p>
        </div>
        <button className="btn-outline" onClick={cancel} disabled={busy}>
          {busy ? '…' : 'إلغاء'}
        </button>
      </div>
    </Screen>
  )
}
