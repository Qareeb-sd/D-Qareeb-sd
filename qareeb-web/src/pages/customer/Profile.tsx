import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import BottomNav from '@/components/BottomNav'
import { useAuth } from '@/store/AuthContext'
import { updateEmergencyContacts } from '@/lib/api'

const links = [
  { label: 'رحلاتي السابقة', icon: '🧾', to: '/rides' },
  { label: 'العناوين المحفوظة', icon: '📍' },
  { label: 'الإشعارات', icon: '🔔' },
  { label: 'المساعدة والدعم', icon: '💬' },
  { label: 'عن قريب', icon: 'ℹ️' },
]

export default function Profile() {
  const navigate = useNavigate()
  const { profile, signOut, refreshProfile } = useAuth()

  const [c1, setC1] = useState(profile?.sos_contact1 ?? '')
  const [c2, setC2] = useState(profile?.sos_contact2 ?? '')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const logout = async () => {
    await signOut()
    navigate('/auth')
  }

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

  return (
    <div className="screen">
      <header className="px-4 py-4">
        <h1 className="text-lg font-bold">حسابي</h1>
      </header>

      <main className="flex-1 px-4 pb-24">
        <div className="card flex items-center gap-4 p-4">
          <div className="grid h-14 w-14 place-items-center rounded-full bg-green-soft text-2xl">
            🧑🏽
          </div>
          <div>
            <p className="font-bold">{profile?.full_name ?? 'مستخدم قريب'}</p>
            <p className="text-sm text-ink-soft" dir="ltr">
              {profile?.phone ?? '—'}
            </p>
          </div>
        </div>

        {/* جهات الطوارئ */}
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
          <button onClick={saveContacts} disabled={busy} className="btn-primary mt-3 w-full">
            {busy ? '…' : 'حفظ جهات الطوارئ'}
          </button>
        </div>

        <div className="card mt-4 divide-y divide-hairline p-0">
          {links.map((l) => (
            <button
              key={l.label}
              onClick={() => l.to && navigate(l.to)}
              className="flex w-full items-center gap-3 px-4 py-3.5 text-right"
            >
              <span className="text-xl">{l.icon}</span>
              <span className="flex-1 font-medium">{l.label}</span>
              <span className="text-ink-muted">‹</span>
            </button>
          ))}
        </div>

        <button onClick={logout} className="btn-outline mt-6 w-full text-danger">
          تسجيل الخروج
        </button>
      </main>

      <BottomNav />
    </div>
  )
}
