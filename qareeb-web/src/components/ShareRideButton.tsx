import { useState } from 'react'
import { ensureRideShare } from '@/lib/api'

/**
 * زر «شارك رحلتي مباشرة» — يولّد رمز تتبّع ويشاركه.
 * المتابِع (لديه تطبيق قريب) يفتح: تتبّع رحلة ← يُدخل الرمز ← يرى الموقع لحظياً.
 * يُستخدم في شاشتَي الرحلة (العميل والسائق).
 */
export default function ShareRideButton({
  rideId,
  variant = 'green',
}: {
  rideId?: string | null
  variant?: 'green' | 'driver'
}) {
  const [busy, setBusy] = useState(false)
  const [token, setToken] = useState<string | null>(null)

  const share = async () => {
    if (!rideId) return
    setBusy(true)
    const t = await ensureRideShare(rideId)
    setBusy(false)
    if (!t) return alert('تعذّر إنشاء رمز المشاركة')
    setToken(t)
    const text = `تابع رحلتي مباشرة عبر تطبيق قريب 🚗\nرمز التتبّع: ${t}\nافتح «قريب» ← تتبّع رحلة ← أدخل الرمز.`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'تتبّع رحلتي في قريب', text })
        return
      }
    } catch {
      /* ألغى المستخدم المشاركة — نُظهر الرمز أدناه */
    }
    try {
      await navigator.clipboard?.writeText(text)
    } catch {
      /* لا حرج — الرمز ظاهر أدناه */
    }
  }

  return (
    <div>
      <button
        onClick={share}
        disabled={busy || !rideId}
        className={`w-full rounded-2xl border py-3 text-sm font-bold ${
          variant === 'driver'
            ? 'border-lemon bg-lemon/15 text-ink'
            : 'border-green/40 bg-green-soft text-green'
        }`}
      >
        {busy ? '…' : '🔗 شارك الرحلة مباشرة'}
      </button>
      {token && (
        <p className="mt-2 text-center text-sm text-ink-soft">
          رمز التتبّع: <span className="font-extrabold tracking-widest text-ink">{token}</span>
        </p>
      )}
    </div>
  )
}
