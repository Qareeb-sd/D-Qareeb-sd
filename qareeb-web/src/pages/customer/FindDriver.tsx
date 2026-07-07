import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import Logo from '@/components/Logo'

/** شاشة البحث عن سائق — مؤقتة، تنتقل تلقائياً لشاشة الرحلة (تُربط بـ Realtime لاحقاً). */
export default function FindDriver() {
  const navigate = useNavigate()

  useEffect(() => {
    const t = setTimeout(() => navigate('/trip'), 2500)
    return () => clearTimeout(t)
  }, [navigate])

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
        <button className="btn-outline" onClick={() => navigate('/home')}>
          إلغاء
        </button>
      </div>
    </Screen>
  )
}
