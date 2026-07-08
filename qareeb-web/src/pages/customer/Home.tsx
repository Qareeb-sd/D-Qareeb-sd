import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import VehicleImage from '@/components/VehicleImage'
import Logo from '@/components/Logo'
import { PinIcon } from '@/components/Icons'
import { services } from '@/data/services'
import { useRide } from '@/store/RideContext'

export default function Home() {
  const navigate = useNavigate()
  const { setServiceId } = useRide()

  const chooseService = (id: string) => {
    setServiceId(id)
    navigate('/select-location')
  }

  return (
    <div className="screen">
      <header className="flex items-center gap-3 px-4 py-4">
        <Logo size={40} rounded={12} />
        <div className="flex-1">
          <p className="text-xs text-ink-muted">أهلاً بك في</p>
          <p className="font-extrabold text-green">قريب</p>
        </div>
      </header>

      <main className="flex-1 px-4 pb-24">
        <button
          onClick={() => navigate('/select-location')}
          className="card flex w-full items-center gap-3 p-4 text-right"
        >
          <span className="grid h-10 w-10 place-items-center rounded-full bg-green-soft text-green">
            <PinIcon />
          </span>
          <span className="flex-1 text-ink-muted">وين ماشي؟</span>
        </button>

        <h2 className="mb-3 mt-6 text-lg font-bold">اختر الخدمة</h2>
        <div className="grid grid-cols-2 gap-3">
          {services.map((s) => {
            const accent = s.femaleDriver
              ? { border: '#E85C9E', bg: '#FDF2F8', title: '#C13584', badge: '🌸 سائقة' }
              : s.id === 'open'
                ? { border: '#E5B800', bg: '#FFF9E0', title: '#A87A00', badge: '⏱️ مفتوح' }
                : null
            return (
              <button
                key={s.id}
                onClick={() => chooseService(s.id)}
                className="card relative flex flex-col items-center gap-2 p-4 text-center transition hover:shadow-lift"
                style={accent ? { border: `1.5px solid ${accent.border}`, backgroundColor: accent.bg } : undefined}
              >
                {accent && (
                  <span
                    className="chip absolute left-2 top-2"
                    style={{ backgroundColor: accent.border, color: '#fff' }}
                  >
                    {accent.badge}
                  </span>
                )}
                <VehicleImage service={s} className="h-16 w-full" />
                <div>
                  <p className="font-bold" style={accent ? { color: accent.title } : undefined}>
                    {s.name}
                  </p>
                  <p className="text-xs text-ink-muted">{s.tagline}</p>
                </div>
              </button>
            )
          })}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
