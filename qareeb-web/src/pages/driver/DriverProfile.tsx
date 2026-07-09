import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DriverNav from '@/components/DriverNav'
import { useAuth } from '@/store/AuthContext'
import { getDriver } from '@/lib/api'
import { getService } from '@/data/services'

export default function DriverProfile() {
  const navigate = useNavigate()
  const { profile, signOut } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const { data: driver } = useQuery({
    queryKey: ['driver', userId],
    queryFn: () => getDriver(userId),
  })

  const logout = async () => {
    await signOut()
    navigate('/auth')
  }

  return (
    <div className="screen">
      <header className="px-4 py-4">
        <h1 className="text-lg font-bold">حسابي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-lemon/30 text-2xl">
            🧑🏽‍✈️
          </div>
          <div>
            <p className="font-bold">{profile?.full_name ?? 'سائق قريب'}</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              {profile?.phone ?? '—'}
            </p>
          </div>
        </div>

        {driver && (
          <div className="card mt-4 divide-y divide-hairline p-0">
            <Row label="المركبة" value={getService(driver.vehicle_type)?.name ?? driver.vehicle_type} />
            <Row label="رقم اللوحة" value={driver.plate_number ?? '—'} />
            <Row label="التقييم" value={`⭐ ${driver.rating ?? '—'}`} />
          </div>
        )}

        <button onClick={logout} className="btn-outline mt-6 w-full text-danger">
          تسجيل الخروج
        </button>
      </main>

      <DriverNav />
    </div>
  )
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between px-4 py-3.5">
      <span className="text-sm text-ink-soft">{label}</span>
      <span className="font-medium">{value}</span>
    </div>
  )
}
