import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import VehicleImage from '@/components/VehicleImage'
import { useAuth } from '@/store/AuthContext'
import { registerDriver } from '@/lib/api'
import { services } from '@/data/services'

/**
 * تسجيل المستخدم كسائق: اختيار نوع المركبة + رقم اللوحة.
 * يرقّي دور الحساب إلى "driver" ثم ينقل لواجهة السائق.
 */
export default function BecomeDriver() {
  const navigate = useNavigate()
  const { profile, refreshProfile } = useAuth()

  const [vehicleType, setVehicleType] = useState(services[0].id)
  const [plate, setPlate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')

  const alreadyDriver = profile?.role === 'driver'

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')
    if (!plate.trim()) return setError('أدخل رقم اللوحة.')
    setBusy(true)
    const { error } = await registerDriver(profile?.id ?? 'demo-user', vehicleType, plate.trim())
    if (error) {
      setBusy(false)
      return setError(error)
    }
    await refreshProfile()
    setBusy(false)
    navigate('/driver')
  }

  if (alreadyDriver) {
    return (
      <Screen title="كن سائقاً" back>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="text-5xl">🧑🏽‍✈️</div>
          <p className="font-bold">أنت مسجّل كسائق بالفعل.</p>
          <button className="btn-primary" onClick={() => navigate('/driver')}>
            الذهاب لواجهة السائق
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="كن سائقاً" back>
      <div className="mb-4">
        <p className="text-sm text-ink-soft">
          سجّل مركبتك وابدأ باستقبال الطلبات وكسب الدخل مع قريب.
        </p>
      </div>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-5">
        <div>
          <label className="label">نوع المركبة</label>
          <div className="grid grid-cols-2 gap-2">
            {services.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setVehicleType(s.id)}
                className={`flex items-center gap-2 rounded-2xl border p-2.5 text-right transition ${
                  vehicleType === s.id
                    ? 'border-green bg-green-soft font-bold text-green'
                    : 'border-hairline bg-white text-ink-soft'
                }`}
              >
                <VehicleImage service={s} className="h-9 w-12 shrink-0" />
                <span className="flex-1 text-sm">{s.name}</span>
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="label">رقم اللوحة</label>
          <input
            className="field"
            value={plate}
            onChange={(e) => setPlate(e.target.value)}
            placeholder="مثال: خ ط م ١٢٣٤"
          />
        </div>

        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? '…' : 'تسجيل كسائق'}
        </button>
      </form>

      <p className="mt-6 text-center text-xs text-ink-muted">
        بالتسجيل أنت توافق على شروط قريب للسائقين.
      </p>
    </Screen>
  )
}
