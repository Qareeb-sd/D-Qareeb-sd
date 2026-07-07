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
          <span className="flex-1 text-ink-muted">وين رايح؟</span>
        </button>

        <h2 className="mb-3 mt-6 text-lg font-bold">اختر الخدمة</h2>
        <div className="grid grid-cols-2 gap-3">
          {services.map((s) => (
            <button
              key={s.id}
              onClick={() => chooseService(s.id)}
              className="card relative flex flex-col items-center gap-2 p-4 text-center transition hover:shadow-lift"
            >
              {s.femaleDriver && (
                <span
                  className="chip absolute left-2 top-2"
                  style={{ backgroundColor: '#FBE4F0', color: '#B03A76' }}
                >
                  سائقة
                </span>
              )}
              <VehicleImage service={s} className="h-16 w-full" />
              <div>
                <p className="font-bold">{s.name}</p>
                <p className="text-xs text-ink-muted">{s.tagline}</p>
              </div>
            </button>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
