import { useEffect, useState } from 'react'
import { getPushStatus } from '@/lib/pushNative'

/**
 * سطر تشخيصي مؤقّت يعرض حالة تسجيل رمز الإشعارات (FCM) — لمعرفة أين يفشل
 * التسجيل دون سجلّ الهاتف. يُحدَّث كل ثانيتين.
 */
export default function PushStatus() {
  const [status, setStatus] = useState(getPushStatus())
  useEffect(() => {
    const iv = setInterval(() => setStatus(getPushStatus()), 2000)
    return () => clearInterval(iv)
  }, [])
  return (
    <p className="mt-3 rounded-xl bg-ink/5 px-3 py-2 text-[10px] text-ink-muted">
      حالة الإشعارات: {status}
    </p>
  )
}
