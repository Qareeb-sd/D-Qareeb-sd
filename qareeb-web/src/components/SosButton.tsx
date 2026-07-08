import { useState } from 'react'
import { useAuth } from '@/store/AuthContext'
import { raiseSos } from '@/lib/api'
import { EMERGENCY_POLICE, QAREEB_SUPPORT_TEL } from '@/theme'
import type { SosRole } from '@/lib/types'

type SendState = 'idle' | 'sending' | 'done' | 'error'

/**
 * زر طوارئ عائم — بضغطة واحدة:
 *  1) يُبلّغ إدارة «قريب» فوراً مع موقعك (يُخزَّن ويظهر لهم لحظياً).
 *  2) يفتح خيارات اتصال مباشر بالشرطة أو دعم قريب.
 * يُستخدم في شاشتي الرحلة (الراكب والسائق).
 */
export default function SosButton({
  rideId,
  role,
}: {
  rideId?: string | null
  role: SosRole
}) {
  const { profile } = useAuth()
  const [open, setOpen] = useState(false)
  const [state, setState] = useState<SendState>('idle')

  const trigger = () => {
    setOpen(true)
    setState('sending')
    const send = (lat?: number, lng?: number) =>
      void raiseSos({ user_id: profile?.id, ride_id: rideId ?? null, role, lat, lng }).then(
        ({ error }) => setState(error ? 'error' : 'done'),
      )

    if ('geolocation' in navigator) {
      navigator.geolocation.getCurrentPosition(
        (p) => send(p.coords.latitude, p.coords.longitude),
        () => send(), // نُرسل التنبيه حتى لو تعذّر الموقع
        { enableHighAccuracy: true, timeout: 6000 },
      )
    } else {
      send()
    }
  }

  return (
    <>
      <button
        onClick={trigger}
        aria-label="زر الطوارئ"
        className="fixed bottom-24 left-4 z-40 grid h-14 w-14 place-items-center rounded-full font-extrabold text-white shadow-lift"
        style={{ backgroundColor: '#C5453B' }}
      >
        <span className="absolute inline-flex h-full w-full animate-ping rounded-full opacity-40" style={{ backgroundColor: '#C5453B' }} />
        <span className="relative">SOS</span>
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-4">
          <div className="w-full max-w-md rounded-3xl bg-white p-5">
            <div className="mb-1 flex items-center gap-2">
              <span className="text-2xl">🚨</span>
              <h2 className="text-lg font-extrabold" style={{ color: '#C5453B' }}>
                طوارئ
              </h2>
            </div>

            <p className="mb-4 text-sm text-ink-soft">
              {state === 'sending' && 'جارٍ إبلاغ إدارة قريب بموقعك…'}
              {state === 'done' && 'تم إبلاغ إدارة قريب بموقعك ✓ — للحالات الخطرة اتصل مباشرة:'}
              {state === 'error' &&
                'تعذّر الإبلاغ عبر الشبكة — اتصل مباشرة بأرقام الطوارئ فوراً:'}
              {state === 'idle' && 'اختر إجراء الطوارئ المناسب:'}
            </p>

            <a
              href={`tel:${EMERGENCY_POLICE}`}
              className="mb-2 flex w-full items-center justify-center gap-2 rounded-2xl py-3.5 text-lg font-extrabold text-white"
              style={{ backgroundColor: '#C5453B' }}
            >
              🚓 اتصال بالشرطة {EMERGENCY_POLICE}
            </a>
            <a
              href={`tel:${QAREEB_SUPPORT_TEL}`}
              className="mb-3 flex w-full items-center justify-center gap-2 rounded-2xl border border-hairline py-3 font-bold text-ink"
            >
              📞 اتصال بدعم قريب
            </a>

            <button
              onClick={() => setOpen(false)}
              className="w-full py-2 text-sm font-bold text-ink-muted"
            >
              إغلاق
            </button>
          </div>
        </div>
      )}
    </>
  )
}
