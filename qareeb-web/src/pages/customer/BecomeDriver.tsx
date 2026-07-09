import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Screen from '@/components/Screen'
import { useAuth } from '@/store/AuthContext'
import { applyAsDriver } from '@/lib/api'
import { services } from '@/data/services'

// أنواع المركبات المتاحة للتسجيل (نستثني «مشوار مفتوح» فهو نمط لا مركبة).
const vehicleOptions = services.filter((s) => s.id !== 'open')

/** تسجيل كسائق — يقدّم الطلب ثم ينتظر موافقة الإدارة. */
export default function BecomeDriver() {
  const navigate = useNavigate()
  const { profile } = useAuth()

  const [vehicle, setVehicle] = useState(vehicleOptions[0].id)
  const [plate, setPlate] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [done, setDone] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!plate.trim()) return
    setBusy(true)
    setError('')
    const { error } = await applyAsDriver({
      user_id: profile?.id,
      vehicle_type: vehicle,
      plate_number: plate.trim(),
    })
    setBusy(false)
    if (error) return setError(error)
    setDone(true)
  }

  if (done) {
    return (
      <Screen title="تسجيل كسائق" back>
        <div className="flex flex-col items-center gap-4 py-16 text-center">
          <div className="text-6xl">✅</div>
          <h2 className="text-xl font-extrabold text-green">تم إرسال طلبك</h2>
          <p className="text-ink-soft">
            طلبك قيد المراجعة من إدارة قريب. سنفعّل حساب السائق فور اعتماده.
          </p>
          <button className="btn-primary mt-2" onClick={() => navigate('/profile')}>
            العودة لحسابي
          </button>
        </div>
      </Screen>
    )
  }

  return (
    <Screen title="تسجيل كسائق" back>
      <p className="mb-4 text-sm text-ink-soft">
        سجّل بياناتك للانضمام كسائق في قريب. بعد اعتماد الإدارة تُفتح لك واجهة السائق.
      </p>

      {error && (
        <p className="mb-4 rounded-2xl bg-danger/10 px-4 py-3 text-center text-sm text-danger">
          {error}
        </p>
      )}

      <form onSubmit={submit} className="space-y-4">
        <div>
          <label className="label">نوع المركبة</label>
          <div className="grid grid-cols-2 gap-2">
            {vehicleOptions.map((s) => (
              <button
                type="button"
                key={s.id}
                onClick={() => setVehicle(s.id)}
                className={`rounded-2xl border p-3 text-sm font-bold transition ${
                  vehicle === s.id
                    ? 'border-green bg-green-soft text-green'
                    : 'border-hairline bg-white text-ink-soft'
                }`}
              >
                {s.name}
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
            required
          />
        </div>

        <button className="btn-primary w-full" type="submit" disabled={busy}>
          {busy ? '…' : 'إرسال طلب التسجيل'}
        </button>
      </form>
    </Screen>
  )
}
