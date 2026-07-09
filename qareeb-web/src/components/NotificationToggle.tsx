import { useEffect, useState } from 'react'
import { enablePush, disablePush, pushState } from '@/lib/push'

/** بطاقة تفعيل/إيقاف إشعارات قريب (Web Push). تختفي إن لم تكن مهيّأة أو مدعومة. */
export default function NotificationToggle({ userId }: { userId: string }) {
  const [supported, setSupported] = useState(true)
  const [subscribed, setSubscribed] = useState(false)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  useEffect(() => {
    const s = pushState()
    if (s === 'unsupported' || s === 'unconfigured') {
      setSupported(false)
      return
    }
    void navigator.serviceWorker.ready
      .then((r) => r.pushManager.getSubscription())
      .then((sub) => setSubscribed(!!sub && Notification.permission === 'granted'))
      .catch(() => {})
  }, [])

  if (!supported) return null

  const toggle = async () => {
    setBusy(true)
    setMsg('')
    if (subscribed) {
      await disablePush()
      setSubscribed(false)
      setMsg('تم إيقاف الإشعارات')
    } else {
      const { ok, error } = await enablePush(userId)
      setSubscribed(ok)
      setMsg(ok ? 'تم تفعيل الإشعارات ✓' : error ?? 'تعذّر التفعيل')
    }
    setBusy(false)
  }

  return (
    <div className="card mt-4 flex items-center gap-3 p-4">
      <span className="text-2xl">🔔</span>
      <div className="flex-1">
        <p className="font-bold">إشعارات قريب</p>
        <p className="text-xs text-ink-soft">
          {msg || (subscribed ? 'مفعّلة — ستصلك التنبيهات المهمة.' : 'فعّلها لتصلك التنبيهات فوراً.')}
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={`shrink-0 rounded-xl px-3 py-1.5 text-sm font-bold ${
          subscribed ? 'bg-hairline text-ink-soft' : 'bg-green text-white'
        }`}
      >
        {busy ? '…' : subscribed ? 'إيقاف' : 'تفعيل'}
      </button>
    </div>
  )
}
