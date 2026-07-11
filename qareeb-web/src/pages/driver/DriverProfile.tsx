import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import DriverNav from '@/components/DriverNav'
import NotificationToggle from '@/components/NotificationToggle'
import { useAuth } from '@/store/AuthContext'
import { getDriver, updateEmergencyContacts } from '@/lib/api'
import { getService } from '@/data/services'

export default function DriverProfile() {
  const navigate = useNavigate()
  const { profile, signOut, refreshProfile } = useAuth()
  const userId = profile?.id ?? 'demo-user'
  const { data: driver } = useQuery({
    queryKey: ['driver', userId],
    queryFn: () => getDriver(userId),
  })

  const [c1, setC1] = useState(profile?.sos_contact1 ?? '')
  const [c2, setC2] = useState(profile?.sos_contact2 ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const saveContacts = async () => {
    setBusy(true)
    setMsg('')
    const { error } = await updateEmergencyContacts(
      profile?.id ?? '',
      c1.trim() || null,
      c2.trim() || null,
    )
    await refreshProfile()
    setBusy(false)
    setMsg(error ? `خطأ: ${error}` : 'تم حفظ جهات الطوارئ ✓')
  }

  const logout = async () => {
    await signOut()
    navigate('/driver/login')
  }

  return (
    <div className="screen">
      <header className="border-b-2 border-lemon px-4 py-4">
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
            <Row
              label="التقييم"
              value={
                driver.rating != null
                  ? `⭐ ${driver.rating} · ${profile?.ratings_count ?? 0} تقييم`
                  : '⭐ —'
              }
            />
          </div>
        )}

        {/* جهات الطوارئ (مثل العميل) */}
        <div className="card mt-4 p-4">
          <div className="mb-1 flex items-center gap-2">
            <span className="text-xl">🆘</span>
            <p className="font-bold">جهات الطوارئ</p>
          </div>
          <p className="mb-3 text-xs text-ink-muted">
            رقمان يصلهما تنبيه فيه موقعك عند ضغطك زر الطوارئ أثناء الرحلة.
          </p>
          <input
            className="field text-left"
            dir="ltr"
            inputMode="tel"
            placeholder="رقم جهة الطوارئ الأولى"
            value={c1}
            onChange={(e) => setC1(e.target.value)}
          />
          <input
            className="field mt-2 text-left"
            dir="ltr"
            inputMode="tel"
            placeholder="رقم جهة الطوارئ الثانية (اختياري)"
            value={c2}
            onChange={(e) => setC2(e.target.value)}
          />
          {msg && <p className="mt-2 text-sm text-green">{msg}</p>}
          <button onClick={saveContacts} disabled={busy} className="btn-driver mt-3 w-full">
            {busy ? '…' : 'حفظ جهات الطوارئ'}
          </button>
        </div>

        <NotificationToggle userId={profile?.id ?? 'demo-user'} />

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
