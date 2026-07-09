import { useEffect, useState } from 'react'
import { enablePush, disablePush, isPushEnabled, isPushConfigured } from '@/lib/push'

/** بطاقة تفعيل/إيقاف إشعارات قريب (Web Push). تختفي إن لم تكن مهيّأة أو مدعومة. */
export default function NotificationToggle({ userId }: { userId: string }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    void isPushEnabled().then(setOn)
  }, [])

  if (!isPushConfigured) return null

  const toggle = async () => {
    setBusy(true)
    setMsg('')
    if (on) {
      await disablePush()
      setOn(false)
      setMsg('تم إيقاف الإشعارات')
    } else {
      const { error } = await enablePush(userId)
      setOn(!error)
      setMsg(error ?? 'تم تفعيل الإشعارات ✓')
    }
    setBusy(false)
  }

  return (
    <div className="card mt-4 flex items-center gap-3 p-4">
      <span className="text-2xl">🔔</span>
      <div className="flex-1">
        <p className="font-bold">إشعارات قريب</p>
        <p className="text-xs text-ink-soft">
          {msg || (on ? 'مفعّلة — ستصلك التنبيهات المهمة.' : 'فعّلها لتصلك التنبيهات فوراً.')}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold ${
          on ? 'bg-hairline text-ink-soft' : 'bg-green text-white'
        }`}
      >
        {busy ? '…' : on ? 'إيقاف' : 'تفعيل'}
      </button>
    </div>
  )
}
